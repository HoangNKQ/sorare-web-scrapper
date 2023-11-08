
const server = 'http://localhost:3000'

const jwtToken = localStorage.getItem('jwtToken');
let isTokenValid = false;
let loginForm = document.getElementById('login-form');
let loginContainer = document.getElementById('login-container');
let loginSuccess = document.getElementById('success-container');
let errorMessage = document.getElementById('error-message');
let fetchButton = document.getElementById('button-fetch');
let input2fa = document.getElementById('2fa-input');

const handlePageLoad = () => {
    if (isTokenValid) {
        // Token is valid, show success container
        loginSuccess.style.display = 'block';
        loginContainer.style.display = 'none';
    } else {
        // Token is invalid or not found, show login container
        loginContainer.style.display = 'block';
    }
};

fetch(server + '/verifyToken')
    .then(
        response => response.json()
    )
    .then(data => {
        isTokenValid = data.tokenValid;
        handlePageLoad();
    });

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    let email = document.getElementById('email').value;
    let password = document.getElementById("password").value;
    let code2fa = document.getElementById("2fa").value;
    fetch(server + '/login', {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password,
            code2fa,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.message === "Login Failed") {
                errorMessage.style.display = "block";
                errorMessage.textContent = "Wrong Credentials";
                errorMessage.style.color = "red";
            }
            else if (data.message === "Need 2FA"){
                input2fa.style.display = "block";
            }
            else if (data.message === "Invalid 2FA code") {
                errorMessage.style.display = "block";
                errorMessage.textContent = "Invalid 2FA code";
                errorMessage.style.color = "red";
            }
            else if (data.message === 'Login Successful'){
                errorMessage.style.display = "none";
                loginContainer.style.display = 'none';
                loginSuccess.style.display = 'flex';
                localStorage.setItem('jwtToken', data.accessToken.token);
            }
        })
        .catch(error => {
            errorMessage.style.display = "block";
            errorMessage.textContent = "Server Error";
            errorMessage.style.color = "red";
        })
})


fetchButton.addEventListener('click', (e) => {
    e.preventDefault();
    fetch(server + '/data', {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jwtToken,
        }),
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.data);
        })
        .catch(error => {
            console.error("error", error);
        })

})