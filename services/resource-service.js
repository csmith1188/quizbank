module.exports.getCourse = (data, courseId) => {
    return data[id];
}

module.exports.getSection = (data, courseId, sectionId) => {
    return data[courseId].sections[sectionId];
}

module.exports.getTask = (data, courseId, sectionId, taskId) => {
    return data[courseId].sections[sectionId].tasks[taskId];