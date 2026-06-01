import { Router, type Router as IRouter } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { registerSchema, loginSchema } from './auth.schema';
import * as authController from './auth.controller';

const router: IRouter = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login',    validate(loginSchema),    authController.login);
router.post('/refresh',                            authController.refresh);
router.post('/logout',                             authController.logout);

export default router;