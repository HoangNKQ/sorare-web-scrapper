const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcrypt');
const nodecron = require('node-cron');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

const apiSource = 'https://api.sorare.com/federation/graphql';

let jwtToken = "";
let headerRows = ["GW", "Date","Time", "S05 League", "League", "Home", "Away",	"HG", "AG",	"TG", "Result"]
let rawData = [];
let processedData = [];

function processData(data, headerRows) {
    processedData = data.map(item => {
        let gameWeek = item.so5Fixture.gameWeek.toString();
        let sourceDate = new Date(item.date);
        let currentDate = new Date();
        let date = sourceDate.toLocaleDateString();
        let time = item.minute.toString();
        let so5league = item.so5Fixture.mySo5Lineups[0].so5Leaderboard.displayName;
        let league = item.competition.displayName;
        let home = item.homeTeam.shortName;
        let away = item.awayTeam.shortName;
        let homeGoals = item.homeGoals.toString();
        let awayGoals = item.awayGoals.toString();
        let totalGoals = (item.homeGoals + item.awayGoals).toString();
        let result = '';
        if (sourceDate > currentDate) {
            result = 'TBD';
        } else if(item.homeGoals === item.awayGoals) {
            result = 'D';
        } else if (item.homeGoals > item.awayGoals) {
            result = 'HW';
        } else { 
            result = 'AW';
        }
        return [gameWeek, date, time, so5league, league, home, away, homeGoals, awayGoals, totalGoals, result];
    })
    processedData.unshift(headerRows);
}

async function populateSheet() {
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    })

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client})

    const spreadsheetId = "1grm2YsOxQ8ymgvYrw3-A9ouHMMsOf_Wlohn623cb_58";

    await googleSheets.spreadsheets.values.clear({
        auth,
        spreadsheetId,
        range: "data",
    })

    await googleSheets.spreadsheets.values.append({
        auth,
        spreadsheetId,
        valueInputOption: 'USER_ENTERED',
        range: "data",
        resource: {
            values: processedData,
        }
    })
}

async function getData(req, res) {
    await axios.post(apiSource, {
        query: `{
            football {
              myOngoingAndRecentGames {
                id
                date
                status
                so5Fixture {
                  mySo5Lineups{
                    so5Leaderboard {
                      displayName
                    }
                  }
                  gameWeek
                }
                competition {
                  displayName 
                }
                homeTeam {
                  __typename
                  ... on Club {
                    shortName
                  }
                }
                awayTeam {
                  __typename
                  ... on Club {
                    shortName
                  }
                }
                homeGoals
                awayGoals
                minute
              }
            }
          }`,
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken.token}`,
            'JWT-AUD': 'SorareData'
        }
    }).then (response => {
        rawData = response.data.data.football.myOngoingAndRecentGames;
        processData(rawData, headerRows);
        console.log(processedData);
        populateSheet();
        // res.status(200).json({data: processedData});
    }).catch(error => {
        console.error("Error Fetching Data", error.response.data, token);
    })
}

app.get('/verifyToken', (req, res) => {
    let currentDate = new Date();
    let tokenExpiredDate = new Date(jwtToken.expiredAt);
    console.log(jwtToken.expiredAt, currentDate);
    if (currentDate < tokenExpiredDate) {
        res.status(200).json({tokenValid: true})
    }
    else {
        res.status(200).json({tokenValid: false})
    }
})

app.post('/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    axios.get(`https://api.sorare.com/api/v1/users/${email}`).then(response => {
        const salt = response.data.salt;
        const hashedPassword = bcrypt.hashSync(password, salt);
        const authData = {
            email: email,
            password: hashedPassword
        };

        axios.post(apiSource, {
            operationName: 'SignInMutation',
            variables: { input: authData },
            query: `mutation SignInMutation($input: signInInput!) {
                    signIn(input: $input) {
                    currentUser {
                        slug
                        jwtToken(aud: "SorareData") {
                        token
                        expiredAt
                        }
                    }
                    otpSessionChallenge
                    tcuToken
                    errors {
                        message
                    }
                    }
                }`
            })
            .then(response => {
                const token = response.data.data.signIn.currentUser.jwtToken;
                jwtToken = token;
                res.status(200).json({message: "Login Successful", accessToken: token});
            })
            .catch(error => {
                res.status(401).json({message: "Login Failed"});
            });
    }).catch(error => {
        console.error('Failed to fetch salt', error);
        res.status(500).json("Server Error");
    });
})

app.post('/data', (req, res) => {
    getData();
})

nodecron.schedule("00 00 00 * * *", function () {
    console.log("-------------");
    console.log("running task every day");
    getData();
});

app.listen(PORT, (error) => {
    if (!error)
        console.log("Server is Successfully Running,  and App is listening on port " + PORT)
    else
        console.log("Error occurred, server can't start", error);
}
); 