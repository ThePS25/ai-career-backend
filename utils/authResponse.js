function formatAuthUser(user) {
  const payload = {
    id: user._id,
    email: user.email,
  };

  if (user.name) {
    payload.name = user.name;
  }
  if (user.avatar) {
    payload.avatar = user.avatar;
  }

  return payload;
}

module.exports = { formatAuthUser };
