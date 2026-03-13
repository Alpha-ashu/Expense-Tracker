import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validateBody, validateParams } from '../../middleware/validate';
import * as TodoController from './todo.controller';
import { todoCreateSchema, todoIdParamSchema, todoUpdateSchema } from './todo.validation';

const router = Router();

router.use(authMiddleware);

router.get('/', TodoController.getTodos);
router.post('/', validateBody(todoCreateSchema), TodoController.createTodo);
router.put('/:id', validateParams(todoIdParamSchema), validateBody(todoUpdateSchema), TodoController.updateTodo);
router.delete('/:id', validateParams(todoIdParamSchema), TodoController.deleteTodo);

export { router as todoRoutes };
