import { Router } from 'express';
import { exportController } from './export.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';

const groupExportRouter = Router({ mergeParams: true });
groupExportRouter.post('/', accessTokenMiddleware, groupMemberMiddleware, (req, res) => {
  void exportController.requestExport(req, res);
});

const exportRouter = Router();
exportRouter.get('/:exportId', accessTokenMiddleware, (req, res) => {
  void exportController.getExportStatus(req, res);
});
exportRouter.get('/:exportId/download', accessTokenMiddleware, (req, res) => {
  void exportController.downloadExport(req, res);
});

export { groupExportRouter, exportRouter };
