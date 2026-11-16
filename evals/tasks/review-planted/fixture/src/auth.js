// Sets req.user from the verified session, or rejects the request.
function requireUser(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'sign in required' });
  req.user = req.session.user; // { id, isAdmin }
  next();
}

module.exports = { requireUser };
