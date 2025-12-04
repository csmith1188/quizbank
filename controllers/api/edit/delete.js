const { isAuthenticated } = require('../../../middleware/auth');
const { deleteResourceForUser } = require('../../../services/resource-service');

module.exports = function (router) {
    router.post('/delete', isAuthenticated, async (req, res) => {
        try {
            const { type, uid } = req.body;

            const result = await deleteResourceForUser({ type, uid });

            if (result.success) {
                res.json({ success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.` });
            } else {
                res.status(400).json({ success: false, message: result.message || 'Error deleting resource.' });
            }
        } catch (error) {
            console.error('Error deleting resource:', error);
            res.status(500).json({ success: false, message: 'Server error deleting resource.' });
        }
    });
};