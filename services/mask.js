// "+27821234567" -> "+2***67": shows the user where a code went without exposing the full contact
module.exports = s => (s ? String(s).replace(/^(.{2}).*(.{2})$/, '$1***$2') : '');
