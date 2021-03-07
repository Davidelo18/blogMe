const { admin } = require('../core/admin');

exports.getPosts = (request, response) => {
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
}

exports.publishPost = (request, response) => {
    if (request.body.body.trim() == '') {
        return response.status(400).json({ body: "Post nie moze byc pusty." });
    }

    const newPost = {
        userName: request.user.handle,
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
}