module.exports = (err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.render('pages/error', { message: 'An unexpected error occurred.', error: err });
}