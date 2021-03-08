const { admin } = require('../core/admin');
const firebase = require('firebase');
const firebaseConfig = require('../core/firebaseConfig');
const { isEmpty, validEmail } = require('../core/validators');
const { request, response } = require('express');
const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { user } = require('firebase-functions/lib/providers/auth');

firebase.initializeApp(firebaseConfig);

exports.signUp = (request, response) => {
    const newUser = {
        nick: request.body.nick,
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

    const defaultImage = `avatar.jpg`;

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
                nick: newUser.nick,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${defaultImage}?alt=media`,
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
}

exports.logIn = (request, response) => {
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
}

exports.uploadAvatar = (request, response) => {
    const busboy = new BusBoy({ headers: request.headers });

    let imageName;
    let uploadImage;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
            return response.status(400).json({ error: "Niepoprawny format pliku. Wgraj obraz JPG lub PNG." });
        }

        const imageExt = filename.split('.')[filename.split('.').length - 1]; // rozszerzenie obrazu
        imageName = `${Math.round(Math.random()*100000000000)}.${imageExt}`;
        const filePath = path.join(os.tmpdir(), imageName);
        uploadImage = { filePath, mimetype };
        file.pipe(fs.createWriteStream(filePath));
    });

    busboy.on('finish', () => {
        admin.storage().bucket().upload(uploadImage.filePath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: uploadImage.mimetype
                }
            }
        })
        .then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageName}?alt=media`;
            return admin.firestore().doc(`/users/${request.user.handle}`).update({ imageUrl });
        })
        .then(() => {
            return response.json({ message: 'Awatar wgrany pomyslnie.' })
        })
        .catch((err) => {
            console.error(err);
            return response.status(500).json({ error: err.code });
        });
    });

    busboy.end(request.rawBody);
};

exports.addUserDetails = (request, response) => {
    const profile = {
        bio: request.body.bio,
        website: request.body.website,
        location: request.body.location
    };

    // --- WALIDACJA ---
    let userDetails = {};

    // informacje w bio
    if (!isEmpty(request.body.bio.trim())) userDetails.bio = profile.bio;

    // strona internetowa
    if (!isEmpty(profile.website.trim())) {
        if (profile.website.trim().substring(0, 4) !== 'http') {
            userDetails.website = `http://${profile.website.trim()}`;
        } else userDetails.website = profile.website;
    }

    // lokalizacja
    if (!isEmpty(profile.location.trim())) userDetails.location = profile.location;

    admin.firestore().doc(`/users/${request.user.handle}`)
    .update(userDetails)
    .then(() => {
        return response.json({ message: "Details added successfully" });
    })
    .catch((err) => {
        console.error(err);
        return response.status(500).json({ error: err.code });
    });
};