import { Router } from 'express';
import { exportController } from './export.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../common/utils';
import { exportParamsDto } from './dto/export.dto';

/** Mounted at /groups/:groupId/exports */
export const groupExportRouter = Router({ mergeParams: true });
groupExportRouter.post('/', accessTokenMiddleware, groupMemberMiddleware, asyncHandler(exportController.requestExport));

/** Mounted at /exports. Access is checked against the group the export belongs to. */
export const exportRouter = Router();
exportRouter.get(
  '/:exportId',
  accessTokenMiddleware,
  validate(exportParamsDto, 'params'),
  asyncHandler(exportController.getExportStatus),
);
exportRouter.get(
  '/:exportId/download',
  accessTokenMiddleware,
  validate(exportParamsDto, 'params'),
  asyncHandler(exportController.downloadExport),
);
