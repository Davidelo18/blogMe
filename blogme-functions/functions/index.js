const functions = require("firebase-functions");
const admin = require('firebase-admin');
const express = require('express');

admin.initializeApp();
const app = express();

app.get('/posts', (request, response) => {
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
            response.json({ message: `document  ${document.id} created successfully` });
        })
        .catch((err) => {
            response.status(500).json({ error: 'something went wrrong' });
            console.error(err);
        });
});

exports.api = functions.region('europe-west1').https.onRequest(app);