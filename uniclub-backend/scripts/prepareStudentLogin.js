// Keep email uniqueness for contact addresses while permitting email-less users.
async function prepareStudentLogin(db) {
  const result = [];
  for (const name of ['users', 'EnrolledUser']) {
    const collection = db.collection(name);
    await collection.createIndex({ email: 1 }, { name: 'email_optional_unique', unique: true, partialFilterExpression: { email: { $type: 'string' } }, background: true });
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (index.name !== 'email_optional_unique' && index.unique === true && Object.keys(index.key).length === 1 && index.key.email === 1 && !index.sparse && !index.partialFilterExpression) await collection.dropIndex(index.name);
    }
    result.push(name);
  }
  return result;
}
module.exports = { prepareStudentLogin };
