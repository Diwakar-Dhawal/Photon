import fs from "fs";
import path from "path";
import * as faceapi from "@vladmandic/face-api";
import * as tf from "@tensorflow/tfjs-node";

const MODEL_DIR = path.join(process.cwd(), "models");

const ensureModelsPresent = () => {
  const required = [
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
  ];
  return required.every((file) => fs.existsSync(path.join(MODEL_DIR, file)));
};

const loadModels = async () => {
  if (!ensureModelsPresent()) {
    return false;
  }
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);
  return true;
};

const detectFacesFromBuffer = async (buffer) => {
  const tensor = tf.node.decodeImage(buffer, 3);
  const detections = await faceapi
    .detectAllFaces(tensor)
    .withFaceLandmarks()
    .withFaceDescriptors();
  tensor.dispose();
  return detections.map((detection) => ({
    embedding: Array.from(detection.descriptor)
      .slice(0, 16)
      .map((value) => value.toFixed(4))
      .join(":"),
  }));
};

const isTfReady = () => tf?.engine?.().state?.numDataBuffers !== undefined;

const initializeFaceDetection = async () => {
  if (!isTfReady()) {
    await tf.ready();
  }
  return loadModels();
};

export {
  initializeFaceDetection,
  detectFacesFromBuffer,
  ensureModelsPresent,
};
