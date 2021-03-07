const { admin } = require('./admin');

module.exports = (request, response, next) => {
    let idToken;
    if (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')) {
        idToken = request.headers.authorization.split('Bearer ')[1];
    } else {
        return response.status(403).json({ error: "Dostep zabroniony." })
    }

    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            request.user = decodedToken;
            admin.firestore().collection('users')
                .where('userId', '==', request.user.uid)
                .limit(1)
                .get()
        })
        .then(data => {
            request.user.handle = data.docs[0].data().handle();
            return next();
        })
        .catch(err => {
            console.error("Problem z weryfikacja tokenu.");
            return response.status(403).json(err);
        })
}