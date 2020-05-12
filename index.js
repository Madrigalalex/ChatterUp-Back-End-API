
const functions = require('firebase-functions');
const app = require('express')();
const FBAuth = require('./util/fbAuth');
const {db} = require('./util/admin');

const cors = require('cors');
app.use(cors());

const {getAllChitChats, postOneChitChat, getChitChat, commentOnChitChat, likeChitChat, unlikeChitChat, deleteChitChat} = require ('./handlers/chitchat');
const {signUp, logIn, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead} = require('./handlers/users');


//ChitChats Routes
app.get('/chitchat', getAllChitChats);
app.post('/chitchat', FBAuth, postOneChitChat);
app.get('/chitchat/:chitchatId', getChitChat);
app.delete('/chitchat/:chitchatId', FBAuth, deleteChitChat);
app.get('/chitchat/:chitchatId/like', FBAuth, likeChitChat);
app.get('/chitchat/:chitchatId/unlike', FBAuth, unlikeChitChat);
app.post('/chitchat/:chitchatId/comment', FBAuth, commentOnChitChat);


//user routes
app.post('/signup', signUp);
app.post('/login', logIn);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

 
 exports.api = functions.region('us-central1').https.onRequest(app);

 exports.createNotificationOnLike = functions.firestore.document('likes/{id}')
    .onCreate((snapshot) => {
       return db.doc(`/chitchat/${snapshot.data().chitchatId}`).get()
            .then( doc => {
                if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'like',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch((err) => 
                console.error(err));
    });

exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}')
    .onDelete((snapshot) => {
       return db.doc(`/notificatoins/${snapshot.id}`)
            .delete()
            .catch(err => {
                console.error(err);
                return;
            });
    });


exports.createNotificationOnComment = functions.firestore.document('comments/{id}')
    .onCreate((snapshot) => {
     return db
        .doc(`/chitchat/${snapshot.data().chitchatId}`)
        .get()
        .then((doc) => {
            if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                return db.doc(`/notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient: doc.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'comment',
                    read: false,
                    screamId: doc.id
                });
            }
        })
        .catch((err) => {
            console.error(err);
            return;

        });
});

exports.onUserImageChange = functions.firestore.document('/users/{userId}')
    .onUpdate((change) => {
        console.log(change.before.data());
        console.log(change.after.data());
        if(change.before.data().imageUrl !== change.after.data().imageUrl){
            console.log('image has changed');
            const batch = db.batch();
        return db.collection('chitchat').where('userHandle', '==', change.before.data().handle).get()
            .then((data) => {
                data.forEach((doc) => {
                    const chitchat = db.doc(`/chitchat/${doc.id}`);
                    batch.update(chitchat, {userImage: change.after.data().imageUrl});
                });
                return batch.commit();
            });

        } else return true;
    });

exports.onChitChatDelete = functions.firestore.document('/chitchat/{chitchatId}')
    .onDelete((snapshot, context) => {
        const chitchatId = context.params.chitchatId;
        const batch = db.batch();
        return db.collection('comments').where('chitchatId', '=='. chitchatId).get()
            .then(data => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/comments/${doc.id}`));
                });
                return db.collection('likes').where('chitchatId', '==', chitchatId).get();
            })
            .then((data) => {
                data.forEach(doc => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                })
                return db.collection('notifications').where('chitchatId', '==', chitchatId).get();
            })
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                });
                return batch.commit();
            })
            .catch(err => console.error(err));
    });
    