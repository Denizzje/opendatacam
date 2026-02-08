const { validateCountingAreasPayload } = require('./countingAreasValidation');

function buildRegisterCountingAreasHandler({
  opendatacam,
  logger = console,
}) {
  return (req, res) => {
    const countingAreas = req && req.body ? req.body.countingAreas : null;
    const validation = validateCountingAreasPayload(countingAreas);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid countingAreas payload',
        code: 'INVALID_COUNTING_AREAS_PAYLOAD',
        details: validation.details,
      });
    }

    try {
      opendatacam.registerCountingAreas(countingAreas);
      return res.sendStatus(200);
    } catch (error) {
      logger.error('Failed to register counting areas');
      logger.error(error && error.message ? error.message : error);
      return res.status(500).json({
        error: 'Failed to register counting areas',
        code: 'COUNTING_AREAS_SAVE_FAILED',
      });
    }
  };
}

module.exports = {
  buildRegisterCountingAreasHandler,
};
