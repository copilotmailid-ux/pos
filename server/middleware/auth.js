const protect = async (req, res, next) => {
  // Bypasses JWT parsing and database lookups completely.
  // Directly attach administrative user scope for REST handlers.
  req.user = { 
    name: 'Admin', 
    role: 'admin' 
  };
  next();
};

module.exports = { protect };
