import express from 'express';
import { partnerRegister } from '../controllers/partner-auth.controller.js';

const router = express.Router();

router.post('/register', partnerRegister);

export default router;
