// Use this format to make new routers

// Basic API route replace the 'key' and 'id' with the actual key and id you want to use
router.get('/key/:id/key/:id', (req, res) => {
    const keyID = Number(req.params.keyID /* keyID would be replaced with CourseID or any other keys id */);

    // If the root object matches the ID you put in return it
    if (data.id !== keyID) {
        // If it doesn't match return an error
        return res.status(404).json({ error: "Course not found" });
    }

    // Make a shallow copy of the data
    const limitedCourse = shallow(data);
    res.json(limitedCourse);
});