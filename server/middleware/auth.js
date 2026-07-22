const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === 'supermart-session-active') {
      req.user = { 
        name: 'Admin', 
        role: 'admin' 
      };
      return next();
    }
  }
  
  return res.status(401).json({ message: 'Unauthorized! Passcode access required.' });
};

module.exports = { protect };
