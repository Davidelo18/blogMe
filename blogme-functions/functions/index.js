const firebase = require('firebase');
const functions = require("firebase-functions");
const admin = require('firebase-admin');
const express = require('express');
const { request, response } = require('express');

const firebaseConfig = {
    apiKey: "AIzaSyA2r0uoqwyZSz_gigL1gAf_lvpruKD49X4",
    authDomain: "blogme-34dd4.firebaseapp.com",
    databaseURL: "https://blogme-34dd4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "blogme-34dd4",
    storageBucket: "blogme-34dd4.appspot.com",
    messagingSenderId: "260072776692",
    appId: "1:260072776692:web:18d22bffdbcc272681cfa1",
    measurementId: "G-BE6E3W8LKN"
};

firebase.initializeApp(firebaseConfig); // inicjalizacja danych z API firebase
admin.initializeApp();
const app = express(); // uzycie biblioteki Express.js do połączeń

// pobranie postów
app.get('/posty', (request, response) => {
    admin
        .firestore()
        .collection('posts')
        .orderBy('publishingTime', 'desc')
        .get()
        .then(data => {
            let posts = [];
            data.forEach(document => {
                posts.push({
                    postId: document.id,
                    body: document.data().body,
                    userName: document.data().userName,
                    publishingTime: document.data().publishingTime
                });
            });

            return response.json(posts);
        })
        .catch(err => console.error(err));
});

// opublikowanie nowego posta
app.post('/post', (request, response) => {
    const newPost = {
        userName: request.body.userName,
        publishingTime: new Date().toISOString(),
        body: request.body.body
    };

    admin.firestore()
        .collection('posts')
        .add(newPost)
        .then((document) => {
            response.json({ message: `Post  ${document.id} opublikowany` });
        })
        .catch((err) => {
            response.status(500).json({ error: 'Nieznany blad' });
            console.error(err);
        });
});

// Funkcje walidacyjne
const isEmpty = (val) => {
    if (val.trim() === '') return true;
    else return false;
};

const validEmail = (email) => {
    const regEx = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

    if (email.match(regEx)) return true;
    else return false;
}

// rejestracja nowego użytkownika
app.post('/rejestracja', (request, response) => {
    const newUser = {
        name: request.body.name,
        surname: request.body.surname,
        email: request.body.email,
        password: request.body.password,
        confirmPassword: request.body.confirmPassword,
        handle: request.body.handle
    };

    let errors = {};

    if (isEmpty(newUser.handle)) {
        errors.handle = "Handle nie moze byc pusty.";
    }

    if (isEmpty(newUser.email)) {
        errors.email = "Prosze podac swoj email.";
    } else if (!validEmail(newUser.email)) {
        errors.email = "Prosze podac prawidlowy e-mail."
    }

    if (isEmpty(newUser.password)) {
        errors.password = "Prosze podac haslo.";
    }

    if (newUser.password !== newUser.confirmPassword) {
        errors.confirm = "Wpisane hasla nie sa takie same.";
    }

    if (Object.keys(errors).length > 0) {
        return response.status(400).json(errors);
    }

    // "skopiowanie" użytkownika do BD - sprawdzenie czy już taki user się nie zarejestrował
    let token, userId;
    admin.firestore()
        .doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if (doc.exists) {
                return response.status(400).json({ handle: `Taki uzytkownik juz istnieje` })
            } else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then(tok => {
            token = tok;
            const userCredentials = {
                handle: newUser.handle,
                name: newUser.name,
                surname: newUser.surname,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId: userId
            };

            return admin.firestore().doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return response.status(200).json({ token });
        })
        .catch(err => {
            console.error(err);
            if(err.code === "auth/email-already-in-use") {
                return response.status(400).json({ email: 'Ten e-mail jest juz w uzyciu' });
            } else {
                return response.status(500).json({ message: `Nieznany blad` });
            }
        });
});

// logowanie
app.post('/logowanie', (request, response) => {
    const user = {
        email: request.body.email,
        password: request.body.password
    };

    let errors = {};

    if (isEmpty(user.email)) {
        errors.email = "Podaj swoj email.";
    }
    if (isEmpty(user.password)) {
        errors.password = "Podaj swoje haslo.";
    }

    if(Object.keys(errors).length > 0) {
        return response.status(400).json(errors);
    }

    firebase.auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then((data) => {
            return data.user.getIdToken();
        })
        .then((tok) => {
            return response.json({ tok });
        })
        .catch((err) => {
            console.error(err);

            if (err.code === "auth/wrong-password") {
                return response.status(403).json({ general: 'Niepoprawny login lub haslo.' });
            } else {
                return response.status(500).json({ message: 'Nieznany blad. Prosze sprobowac pozniej.' });
            }
        })
});

exports.api = functions.region('europe-west1').https.onRequest(app);