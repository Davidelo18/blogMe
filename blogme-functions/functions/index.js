const firebase = require('firebase');
const functions = require("firebase-functions");
const express = require('express');
const { request, response } = require('express');
const { getPosts, publishPost } = require('./functionality/posts');
const { signUp, logIn, uploadAvatar, addUserDetails } = require('./functionality/users');
const FbAuth = require('./core/fbAuth');

const app = express(); // uzycie biblioteki Express.js do połączeń

// ================
// === 1. Posty ===
// ================

// pobranie postów
app.get('/posty', getPosts);
// opublikowanie nowego posta
app.post('/post', FbAuth, publishPost);

// ======================
// === 2. Użytkownicy ===
// ======================

// rejestracja nowego użytkownika
app.post('/rejestracja', signUp);
// logowanie
app.post('/logowanie', logIn);
// ustawienie zdjęcia profilowego
app.post('/profil/avatar', FbAuth, uploadAvatar);
// dodanie informacji o profilu użytkownika
app.post('/profil/szczegoly', FbAuth, addUserDetails);

exports.api = functions.region('europe-west1').https.onRequest(app);