const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Role mapping: new roles map to old role permissions
const roleMapping = {
  'chairperson': 'admin',
  'treasurer': 'cashier',
  'coordinator': 'worker',
  'lac_convener': 'worker',
  'regional_coordinator': 'admin',
  'registrar': 'admin',
  // Keep old roles for backward compatibility
  'admin': 'admin',
  'cashier': 'cashier',
  'worker': 'worker',
};

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    const userRole = req.user.role;
    const mappedRole = roleMapping[userRole] || userRole;
    
    // Check if user's role (or mapped role) is in allowed roles
    const hasAccess = roles.includes(userRole) || roles.includes(mappedRole);
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
