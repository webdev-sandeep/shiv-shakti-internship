require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const ObjectId = mongoose.Types.ObjectId;
const port = 5000;

//App initialize
const app = express();

//middlewares
app.use(cors());
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));

//Setting up the connection
var conn = mongoose.createConnection(process.env.MONGODB_URL);

let gfs;
conn.once("open", () => {
  //Initialize the stream
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

//Create Storage Object
const storage = new GridFsStorage({
  url: process.env.MONGODB_URL,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({ storage });

//Endpoints
app.get("/", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length == 0) {
      res.json({ message: "No file Exist" });
    } else {
      files.map((file) => {
        if (
          file.contentType === "image/jpeg" ||
          file.contentType === "image/png"
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.json({ files: [...files] });
    }
  });
});

app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: "No file exists",
      });
    }

    // Check if image
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      // Read output to browser
      const readStream = gridfsBucket.openDownloadStream(file._id);
      readStream.pipe(res);
    } else {
      res.status(404).json({
        err: "Not an image",
      });
    }
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ file: req.file });
});

app.delete("/file/:id", async (req, res) => {
  const documents = await gridfsBucket
    .find({
      _id: new ObjectId(req.params.id),
    })
    .toArray();

  if (documents.length === 0) {
    throw new Error("FileNotFound");
  }
  return Promise.all(
    documents.map((doc) => {
      return gridfsBucket.delete(doc._id);
    })
  );
});

//Starting the server
app.listen(port, () => {
  console.log(`server is running at : http://localhost:${port}`);
});
