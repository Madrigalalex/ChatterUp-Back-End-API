const {db} = require('../util/admin');

exports.getAllChitChats = (req, res) =>{
    db
    .collection('chitchat')
    .orderBy('createdAt', 'desc')
    .get()
    .then((data) => {
        let chitchats = [];
        data.forEach((doc) => {
            chitchats.push({
                chitchatId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                commentCount: doc.data().commentCount,
                likeCount: doc.data().likeCount,
                userImage: doc.data().userImage

        });
        });
        return res.json(chitchats);
    })
    .catch((err) => {
        console.error(err);
        res.status(500).json({error: err.code});
    });
}




exports.postOneChitChat = (req, res) => {
    if (req.body.body.trim() === ''){
        return res.status(400).json({body: 'Body must not be empty'});
    }
     const newChitChat = {
         body: req.body.body,
         userHandle: req.user.handle,
         userImage: req.user.imageUrl,
         createdAt: new Date().toISOString(),
         likeCount: 0,
         commentCount: 0
     };
     db.collection('chitchat')
     .add(newChitChat)
     .then((doc) =>{
         const resChitChat = newChitChat;
         resChitChat.chitchatId = doc.id;
        res.json(resChitChat);
     })
     .catch((err) => {
         res.status(500).json({ error: 'something went wrong'});
         console.error(err);
     });

 };

 exports.getChitChat = (req,res) => {
    let chitchatData = {};

    db.doc(`/chitchat/${req.params.chitchatId}`).get()
        .then(doc => {
            if (!doc.exists){
                return res.status(404).json({ error: 'Chitchat not found'});
            }
            chitchatData = doc.data();
            chitchatData.chitchatId = doc.id;
            return db.collection('comments').orderBy('createdAt', 'desc').where('chitchatId', '==', req.params.chitchatId).get();
        })
        .then((data) => {
            chitchatData.comments = [];
            data.forEach((doc) => {
                chitchatData.comments.push(doc.data())
            });
            return res.json(chitchatData);
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({error: err.code});
        });

 };

 //comment on a chitchat

 exports.commentOnChitChat = (req, res) => {
     if(req.body.body.trim() === '') return res.status(400).json({comment: 'Must not be empty'});

     const newComment = {
         body: req.body.body,
         createdAt: new Date().toISOString(),
         chitchatId: req.params.chitchatId,
         userHandle: req.user.handle,
         userImage: req.user.imageUrl   
     }

     console.log(newComment);

     db.doc(`/chitchat/${req.params.chitchatId}`).get()
        .then(doc => {
            if(!doc.exists) {
                return res.status(404).json({error: 'Chitchat not found'});
            }
            return doc.ref.update({commentCount: doc.data().commentCount + 1});
        })
        .then(() => {
            return db.collection('comments').add(newComment);
        }) 
        .then(() => {
            res.json(newComment);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: 'Something went wrong'});
        })
 }


 //function to like a chitchat
 exports.likeChitChat = (req,res) => {
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
        .where('chitchatId', '==', req.params.chitchatId).limit(1);
    const chitchatDocument = db.doc(`/chitchat/${req.params.chitchatId}`);

    let chitchatData = {};

    chitchatDocument.get()
        .then(doc => {
            if(doc.exists){
                chitchatData = doc.data();
                chitchatData.chitchatId = doc.id;
                return likeDocument.get();
            } else {
                return res.status(404).json({error: 'Chitchat not found'});
            }
        })
        .then(data => {
            if(data.empty){
                return db.collection('likes').add({
                    chitchatId: req.params.chitchatId,
                    userHandle: req.user.handle
                })
                .then(() => {
                    chitchatData.likeCount++
                    return chitchatDocument.update({likeCount: chitchatData.likeCount});
                })
                .then(() => {
                    return res.json(chitchatData);
                })
            } else {
                return res.status(400).json({error: 'Chitchat already liked'});
            }
        })
        .catch(err => {
            console.error(err)
            res.status(500).json({error: err.code});
        });

 };

 //function to unlike a chitchat
 exports.unlikeChitChat = (req,res) => {
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('chitchatId', '==', req.params.chitchatId).limit(1);
const chitchatDocument = db.doc(`/chitchat/${req.params.chitchatId}`);

let chitchatData = {};

chitchatDocument.get()
    .then(doc => {
        if(doc.exists){
            chitchatData = doc.data();
            chitchatData.chitchatId = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({error: 'Chitchat not found'});
        }
    })
    .then(data => {
        if(data.empty){
            return res.status(400).json({error: 'Chitachat not liked'});
            
        } else {
            return db.doc(`/likes/${data.docs[0].id}`)
                .delete()
                .then(() => {
                    chitchatData.likeCount--;
                    return chitchatDocument.update({likeCount: chitchatData.likeCount});
                })
                .then(() => {
                    res.json(chitchatData);
                }); 
        }
    })
    .catch(err => {
        console.error(err)
        res.status(500).json({error: err.code});
    });


 };

 //function to delete a chitchat
 exports.deleteChitChat = (req,res) => {
    const document = db.doc(`/chitchat/${req.params.chitchatId}`);
    document.get()
        .then((doc) => {
        if (!doc.exists){
            return res.status(404).json({error: 'Chitchat not found'});

        }
        if (doc.data().userHandle !== req.user.handle){
            return res.status(403).json({error: 'Unauthorized'});
        } else {
            return document.delete();
        }
    })
    .then(() => {
        res.json({message: 'Chitchat deleted successfully'});
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code});
    });

 };