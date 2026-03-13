import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as FriendController from './friend.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', FriendController.getFriends);
router.post('/', FriendController.createFriend);
router.put('/:id', FriendController.updateFriend);
router.delete('/:id', FriendController.deleteFriend);

export { router as friendRoutes };
