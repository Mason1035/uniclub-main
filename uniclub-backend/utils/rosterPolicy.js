const EMAIL_PATTERN = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
const ID_PATTERN = /^\d{6,20}$/;
const error = (message, status = 400) => Object.assign(new Error(message), { status });

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw error('名单记录格式不正确。');
  const rawId = entry.uniqueId ?? entry.unique_id ?? entry.studentId ?? entry.student_id ?? entry['学号'];
  const rawName = entry.name ?? entry.studentName ?? entry['姓名'];
  if (!(typeof rawId === 'string' || Number.isSafeInteger(rawId))) throw error('请输入有效的学号。');
  const uniqueId = String(rawId).trim();
  if (!ID_PATTERN.test(uniqueId)) throw error('学号应为 6 至 20 位数字。');
  if (typeof rawName !== 'string' || !rawName.trim() || rawName.trim().length > 100 || /[\x00-\x1f\x7f]/.test(rawName)) throw error('姓名不能为空，且不能包含换行或控制字符。');
  const rawEmail = entry.email ?? entry.mail ?? entry['邮箱'];
  let email;
  if (rawEmail !== undefined && rawEmail !== null && rawEmail !== '') {
    if (typeof rawEmail !== 'string') throw error('联系邮箱格式不正确。');
    email = rawEmail.trim().toLowerCase();
    if (email && !EMAIL_PATTERN.test(email)) throw error('联系邮箱格式不正确。');
  }
  return { uniqueId, name: rawName.trim(), ...(email ? { email } : {}) };
}

function validateEntries(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 2000) throw error('请提供 1 至 2000 条名单记录。');
  const ids = new Set(), emails = new Set();
  return entries.map((entry, index) => {
    let row;
    try { row = normalizeEntry(entry); } catch (e) { throw error(`第 ${index + 1} 条：${e.message}`); }
    if (ids.has(row.uniqueId)) throw error(`第 ${index + 1} 条：学号重复，请先核对名单。`);
    if (row.email && emails.has(row.email)) throw error(`第 ${index + 1} 条：联系邮箱重复，请先核对名单。`);
    ids.add(row.uniqueId); if (row.email) emails.add(row.email);
    return row;
  });
}

// Supports Excel paste, CSV/TSV and the former email,name,studentId format.
function parseRosterText(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 500000) throw error('请粘贴有效的名单内容。');
  const first = text.trim().replace(/^\uFEFF/, '').split(/\r?\n/)[0];
  const delimiter = first.includes('\t') ? '\t' : first.includes(',') ? ',' : first.includes('，') ? '，' : null;
  let rows = [];
  if (!delimiter) rows = text.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/));
  else {
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === delimiter) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (quoted) throw error('名单中的引号没有闭合。');
    row.push(field); rows.push(row);
  }
  rows = rows.filter(row => row.some(value => value.trim()));
  const keys = rows[0]?.map(value => value.trim().toLowerCase().replace(/^\uFEFF/, '')) || [];
  const idIndex = keys.findIndex(key => ['学号', 'uniqueid', 'unique_id', 'studentid', 'student_id', 'id'].includes(key));
  const nameIndex = keys.findIndex(key => ['姓名', 'name', 'studentname', 'student_name', '名字'].includes(key));
  const emailIndex = keys.findIndex(key => ['邮箱', 'email', 'mail', 'e-mail', '电子邮箱'].includes(key));
  if (idIndex >= 0 || nameIndex >= 0 || emailIndex >= 0) {
    if (idIndex < 0 || nameIndex < 0) throw error('表头需要学号和姓名两列。');
    return rows.slice(1).map(row => ({ uniqueId: row[idIndex], name: row[nameIndex], ...(emailIndex >= 0 ? { email: row[emailIndex] } : {}) }));
  }
  return rows.map((row, index) => {
    if (row.length === 3 && row[0].includes('@')) return { email: row[0], name: row[1], uniqueId: row[2] };
    if (row.length !== 2) throw error(`第 ${index + 1} 行：需要学号、姓名两项；可直接粘贴 Excel 两列。`);
    return ID_PATTERN.test(row[0].trim()) ? { uniqueId: row[0], name: row[1] } : { uniqueId: row[1], name: row[0] };
  });
}

module.exports = { normalizeEntry, validateEntries, parseRosterText, error };
