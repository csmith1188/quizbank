module.exports.getRandomItems = (array, count) => {
    const maxCount = Math.min(count, 20); // Limit to maximum 20 questions
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, maxCount);
}