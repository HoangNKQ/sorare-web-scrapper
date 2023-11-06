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
let headerRows = ["Date", "Game Time", "Home team", "Away team",	"Home Score", "Away Score",	"Total Goals", "Result"]
let rawData = [];
let processedData = [];

function processData(data) {
    console.log(data);
    processedData = data.map(item => {
        return [item.date.slice(0, 10), item.minute, item.homeTeam.shortName, item.awayTeam.shortName, item.homeGoals, item.awayGoals, item.homeGoals + item.awayGoals, item.homeGoals.toString() + '-' + item.awayGoals.toString()];
    })
    processedData.unshift(headerRows);
}

async function populateSheet(req, res) {
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets"
    })

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client})

    const spreadsheetId = "1grm2YsOxQ8ymgvYrw3-A9ouHMMsOf_Wlohn623cb_58";

    // const metaData = await googleSheets.spreadsheets.get({
    //     auth,
    //     spreadsheetId,
    // })

    // const getRows = await googleSheets.spreadsheets.values.get({
    //     auth,
    //     spreadsheetId,
    //     range: "data",
    // })

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
            // values: [['3', 'rw43', '23425', 't5w4t','2ef24', '0', '3' ,'5' ]]
        }
    })
    // res.json(getRows);
}

async function getData(req, res) {
    await axios.post(apiSource, {
        query: `{
            football{
              myOngoingAndRecentGames{
                id
                date
                status
                homeTeam {
                  __typename
                    ...on Club {
                    shortName
                  }
                }
                awayTeam {
                  __typename
                  ...on Club {
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
            'JWT-AUD': 'hoang'
        }
    }).then (response => {
        rawData = response.data.data.football.myOngoingAndRecentGames;
        processData(rawData);
        console.log(processedData);
        populateSheet(req, res);
        res.status(200).json({data: response.data});
    }).catch(error => {
        console.error("Error Fetching Data", error.response.data, token);
    })
}

app.get('/test', (req, res) => {
    populateSheet(req,res);
})

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
                        jwtToken(aud: "hoang") {
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
                console.log(token, "first token");
                res.status(200).json({message: "Login Successful", accessToken: token});
            })
            .catch(error => {
                console.error('Authentication failed:', error);
                res.status(401).json({message: "Login Failed"});
            });
    }).catch(error => {
        console.error('Failed to fetch salt', error);
        res.status(500).json("Server Error");
    });
})


app.post('/data', (req, res) => {
    getData(req, res);
})

app.listen(PORT, (error) => {
    if (!error)
        console.log("Server is Successfully Running,  and App is listening on port " + PORT)
    else
        console.log("Error occurred, server can't start", error);
}
); 