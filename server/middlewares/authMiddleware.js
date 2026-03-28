export const protect = async (req, res, next) => {
    try {
        const { userId } = await req.auth()
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        req.userId = userId  // ✅ yeh add kar
        next()
    }
    catch (error) {
        console.error(error);
        res.status(401).json({ message: error.code || error.message });
    }
}