
const server = 'http://localhost:3000'

const jwtToken = localStorage.getItem('jwtToken');
let isTokenValid = false;
let loginForm = document.getElementById('login-form');
let loginContainer = document.getElementById('login-container');
let loginSuccess = document.getElementById('success-container');
let errorMessage = document.getElementById('error-message');
let fetchButton = document.getElementById('button-fetch');

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

    fetch(server + '/login', {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.message === "Login Failed") {
                errorMessage.textContent = "Failed to login";
                errorMessage.style.color = "red";
            }
            else {
                loginContainer.style.display = 'none';
                loginSuccess.style.display = 'block';
                localStorage.setItem('jwtToken', data.accessToken.token);
            }
        })
        .catch(error => {
            errorMessage.textContent = error;
        })
    // email.value = "";
    // password.value = "";
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