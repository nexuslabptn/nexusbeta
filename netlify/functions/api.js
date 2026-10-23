/**
 * netlify/functions/api.js — Serverless API Handler for Netlify (nexuslabpt.netlify.app)
 * Cung cấp đầy đủ REST API cho Đánh giá, Xác thực, Phân quyền trên Netlify
 */

const fs = require('fs');
const path = require('path');

function hashPassword(plain, salt = 'nexus_salt_v2_2026') {
  if (!plain) return '';
  if (typeof plain === 'string' && plain.startsWith('nx_hash_')) return plain;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const s = String(plain) + ':' + salt;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'nx_hash_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// In-memory fallback for serverless cold-starts
let memoryDb = {
  users: [
    {
      id: 'admin_nexus_01',
      username: 'adminnexus',
      email: 'adminnexus@nexus.edu.vn',
      password: hashPassword('04082012'),
      name: 'Quản Trị Viên NexusLab',
      role: 'admin',
      roleLabel: 'Quản trị viên Hệ thống',
      isAdmin: true,
      canDeleteComments: true,
      canDownloadPremium: true
    },
    {
      id: 'admin_nexus_02',
      username: 'nexusadmin',
      email: 'nexusadmin@nexus.edu.vn',
      password: hashPassword('04082012'),
      name: 'Admin NexusLab Studio',
      role: 'admin',
      roleLabel: 'Quản trị viên Cấp cao',
      isAdmin: true,
      canDeleteComments: true,
      canDownloadPremium: true
    },
    {
      id: 'user_nexus_pre',
      username: 'nexuspre',
      email: 'nexuspre@nexus.edu.vn',
      password: hashPassword('0915903757'),
      name: 'Nexus Premium Member',
      role: 'premium',
      roleLabel: 'Thành viên Premium VIP',
      canDownloadPremium: true
    },
    {
      id: 'user_nexus_ult',
      username: 'nexusult',
      email: 'nexusult@nexus.edu.vn',
      password: hashPassword('0915903757'),
      name: 'Nexus Ultimate Member',
      role: 'ultimate',
      roleLabel: 'Thành viên Ultimate VIP',
      canDownloadPremium: true
    }
  ],
  reviews: [
    {
      id: 'rev_1729000000001',
      userId: 'user_gv_01',
      userName: 'ThS. Hoàng Tuấn Anh',
      userRole: 'Giáo viên',
      userAvatar: '👨‍🏫',
      userIdentifier: 'tuananh@nexus.edu.vn',
      rating: 5,
      content: 'Phòng thí nghiệm ảo 60 FPS rất mượt mà! Học sinh lớp 9 của tôi tiếp thu bài phân li Menđen và định luật Ôm nhanh gấp đôi khi được trực tiếp quan sát và tương tác trên máy tính.',
      tags: ['Mô phỏng chân thực', 'Hỗ trợ giảng dạy'],
      createdAt: '2026-10-18T08:30:00.000Z',
      likes: 24
    },
    {
      id: 'rev_1729000000002',
      userId: 'user_hs_01',
      userName: 'Nguyễn Hải Đăng',
      userRole: 'Học sinh',
      userAvatar: '👨‍🎓',
      userIdentifier: 'haidang@nexus.edu.vn',
      rating: 5,
      content: 'Giao diện siêu đẹp, animation mượt và không bị lag giật. Mình thích nhất phần mô phỏng Kính hiển vi sống và cấu trúc ADN xoắn kép, trực quan hơn nhiều so với hình vẽ tĩnh trong SGK!',
      tags: ['Giao diện đỉnh cao', 'Dễ hiểu'],
      createdAt: '2026-10-19T14:15:00.000Z',
      likes: 18
    },
    {
      id: 'rev_1729000000003',
      userId: 'user_hs_02',
      userName: 'Trần Thị Mai Anh',
      userRole: 'Học sinh',
      userAvatar: '👩‍🔬',
      userIdentifier: 'maianh@nexus.edu.vn',
      rating: 5,
      content: 'Nhờ có NexusLab mà mình đạt điểm 10 thực hành Hóa Học! Phản ứng tráng gương glucose và màu hồ tinh bột mô phỏng đổi màu theo nhiệt độ cực kỳ chân thực.',
      tags: ['Mô phỏng chân thực', 'Đạt điểm cao'],
      createdAt: '2026-10-20T09:45:00.000Z',
      likes: 15
    }
  ]
};

// Response helper
function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-User, X-Admin-Pass',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-User, X-Admin-Pass',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  // Parse path: strip leading netlify function prefix if present
  let p = event.path || '';
  if (p.includes('/.netlify/functions/api')) {
    p = p.replace('/.netlify/functions/api', '/api');
  }
  if (!p.startsWith('/api')) {
    p = '/api' + p;
  }

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  // 1. GET /api/reviews
  if (p === '/api/reviews' && event.httpMethod === 'GET') {
    return jsonResponse(200, { success: true, reviews: memoryDb.reviews });
  }

  // 2. POST /api/reviews (Thêm nhận xét, 1 người dùng 1 lần)
  if (p === '/api/reviews' && event.httpMethod === 'POST') {
    const userId = (body.userId || '').trim();
    const userName = (body.userName || '').trim();
    const userIdentifier = (body.userIdentifier || userId || userName).toLowerCase().trim();

    if (!userName || !body.content || !body.rating) {
      return jsonResponse(400, { success: false, message: 'Thiếu họ tên, nội dung đánh giá hoặc điểm số sao!' });
    }

    // Single-review check
    const hasReviewed = memoryDb.reviews.some(r => {
      if (userId && r.userId && r.userId === userId) return true;
      if (userIdentifier && r.userIdentifier && r.userIdentifier === userIdentifier) return true;
      if (userName && r.userName && r.userName.toLowerCase() === userName.toLowerCase() && userId !== 'anonymous') return true;
      return false;
    });

    if (hasReviewed) {
      return jsonResponse(400, {
        success: false,
        message: 'Mỗi tài khoản người dùng chỉ được gửi đánh giá 1 lần để đảm bảo tính khách quan.'
      });
    }

    const newRev = {
      id: 'rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      userId: userId || ('user_' + Date.now()),
      userName: userName,
      userRole: body.userRole || 'Học sinh',
      userAvatar: body.userAvatar || '👨‍🎓',
      userIdentifier: userIdentifier,
      rating: Math.max(1, Math.min(5, parseInt(body.rating) || 5)),
      content: String(body.content || '').slice(0, 1000).trim(),
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 5) : [],
      createdAt: new Date().toISOString(),
      likes: 0
    };

    memoryDb.reviews.unshift(newRev);

    return jsonResponse(201, {
      success: true,
      review: newRev,
      message: 'Gửi đánh giá và nhận xét thành công!'
    });
  }

  // 3. DELETE /api/reviews/:id (Chỉ adminnexus / nexusadmin pass: 04082012 mới có quyền xóa)
  if (p.startsWith('/api/reviews/') && event.httpMethod === 'DELETE') {
    const reviewId = p.replace('/api/reviews/', '').trim();
    const adminUser = (body.adminUser || event.headers['x-admin-user'] || '').trim().toLowerCase();
    const adminPass = body.adminPass || event.headers['x-admin-pass'] || '';

    const isAdmin = ((adminUser === 'adminnexus' || adminUser === 'nexusadmin') && adminPass === '04082012') ||
                    ((adminUser === 'adminnexus' || adminUser === 'nexusadmin') && hashPassword(adminPass) === hashPassword('04082012'));

    if (!isAdmin) {
      return jsonResponse(403, {
        success: false,
        message: 'Quyền bị từ chối: Chỉ tài khoản Quản trị viên (adminnexus / nexusadmin) mới có quyền xóa comment!'
      });
    }

    const prevCount = memoryDb.reviews.length;
    memoryDb.reviews = memoryDb.reviews.filter(r => r.id !== reviewId);

    if (memoryDb.reviews.length === prevCount) {
      return jsonResponse(404, { success: false, message: 'Không tìm thấy đánh giá cần xóa.' });
    }

    return jsonResponse(200, { success: true, message: 'Đã xóa comment thành công (Quyền Quản trị viên).' });
  }

  // 4. POST /api/reviews/like
  if (p === '/api/reviews/like' && event.httpMethod === 'POST') {
    const revId = body.id;
    const rev = memoryDb.reviews.find(r => r.id === revId);
    if (rev) {
      rev.likes = (rev.likes || 0) + 1;
      return jsonResponse(200, { success: true, likes: rev.likes });
    }
    return jsonResponse(404, { success: false, message: 'Không tìm thấy đánh giá.' });
  }

  // 5. POST /api/auth/login
  if (p === '/api/auth/login' && event.httpMethod === 'POST') {
    const identifier = (body.identifier || '').trim().toLowerCase();
    const password = body.password || '';

    const user = memoryDb.users.find(u => {
      const matchIdent = (u.username && u.username.toLowerCase() === identifier) ||
                         (u.email && u.email.toLowerCase() === identifier);
      if (!matchIdent) return false;
      return u.password === hashPassword(password) || u.password === password;
    });

    if (user) {
      const safeUser = Object.assign({}, user);
      delete safeUser.password;
      return jsonResponse(200, { success: true, user: safeUser });
    }
    return jsonResponse(401, { success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  // 6. POST /api/auth/register
  if (p === '/api/auth/register' && event.httpMethod === 'POST') {
    const username = (body.username || '').trim().toLowerCase();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!username && !email) {
      return jsonResponse(400, { success: false, message: 'Thiếu tên tài khoản hoặc email.' });
    }

    const newUser = {
      id: 'user_' + Date.now(),
      username: username || email.split('@')[0],
      email: email || `${username}@nexus.edu.vn`,
      password: hashPassword(password),
      name: body.name || 'Người dùng NexusLab',
      role: body.role || 'student',
      roleLabel: body.role === 'teacher' ? 'Giáo viên' : 'Học sinh',
      grade: body.grade || 'Lớp 9',
      school: body.school || 'THCS/THPT',
      avatar: body.role === 'teacher' ? '👨‍🏫' : '👨‍🎓',
      createdAt: new Date().toISOString()
    };

    memoryDb.users.push(newUser);
    const safeUser = Object.assign({}, newUser);
    delete safeUser.password;
    return jsonResponse(201, { success: true, user: safeUser });
  }

  return jsonResponse(404, { success: false, message: 'API Endpoint not found on Netlify.' });
};
