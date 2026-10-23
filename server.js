// NexusLab EdTech Server - Node.js Built-in Server with Persistent Database
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// -------------------------------------------------------------
// PASSWORD HASHING HELPER (Compatible with auth.js)
// -------------------------------------------------------------
function hashPassword(plain, salt = 'nexus_lab_2026_salt') {
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

// -------------------------------------------------------------
// DATABASE INITIALIZATION & FILE PERSISTENCE
// -------------------------------------------------------------
function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
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
            grade: 'Ban Quản Trị Trung Tâm',
            school: 'NEXUSLAB Science Hub',
            avatar: '🛡️',
            xp: 99999,
            level: 'System Administrator',
            badges: ['Quản trị tối cao', 'Bảo mật NexusLab', 'Master 60 FPS'],
            completedLabs: ['ly1', 'ly2', 'ly3', 'ly4', 'ly5', 'ly6', 'ly7', 'ly8', 'hoa1', 'hoa2', 'hoa3', 'hoa4', 'hoa5', 'hoa6', 'hoa7', 'hoa8', 'hoa9', 'sinh1', 'sinh2', 'sinh3', 'sinh4', 'sinh5', 'sinh6', 'sinh7', 'sinh8', 'sinh9', 'sinh10', 'sinh11', 'sinh12']
          }
        ],
        reviews: [
          {
            id: 'rev_1729000000001',
            userId: 'user_gv_01',
            userName: 'ThS. Hoàng Tuấn Anh',
            userRole: 'Giáo viên',
            userAvatar: '👨‍🏫',
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
            rating: 5,
            content: 'Nhờ có NexusLab mà mình đạt điểm 10 thực hành Hóa Học! Phản ứng tráng gương glucose và màu hồ tinh bột mô phỏng đổi màu theo nhiệt độ cực kỳ chân thực.',
            tags: ['Mô phỏng chân thực', 'Đạt điểm cao'],
            createdAt: '2026-10-20T09:45:00.000Z',
            likes: 15
          }
        ]
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      return initialData;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.users) data.users = [];
    if (!data.reviews) data.reviews = [];

    // Ensure privileged accounts (adminnexus, nexusadmin, nexuspre, nexusult) are always present
    const defaultPrivilegedAccounts = [
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
        canDownloadPremium: true,
        grade: 'Ban Quản Trị Trung Tâm',
        school: 'NEXUSLAB Science Hub',
        avatar: '🛡️',
        xp: 99999,
        level: 'System Administrator',
        badges: ['Quản trị tối cao', 'Bảo mật NexusLab', 'Master 60 FPS'],
        completedLabs: ['ly1', 'ly2', 'ly3', 'ly4', 'ly5', 'ly6', 'ly7', 'ly8', 'hoa1', 'hoa2', 'hoa3', 'hoa4', 'hoa5', 'hoa6', 'hoa7', 'hoa8', 'hoa9', 'sinh1', 'sinh2', 'sinh3', 'sinh4', 'sinh5', 'sinh6', 'sinh7', 'sinh8', 'sinh9', 'sinh10', 'sinh11', 'sinh12']
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
        canDownloadPremium: true,
        grade: 'Ban Quản Trị Studio',
        school: 'NEXUSLAB Science Hub',
        avatar: '⚡',
        xp: 99999,
        level: 'Studio Administrator',
        badges: ['Quản trị viên', 'Scanner VIP Master'],
        completedLabs: ['ly1', 'ly2', 'ly3', 'ly4', 'ly5', 'ly6', 'ly7', 'ly8', 'hoa1', 'hoa2', 'hoa3', 'hoa4', 'hoa5', 'hoa6', 'hoa7', 'hoa8', 'hoa9', 'sinh1', 'sinh2', 'sinh3', 'sinh4', 'sinh5', 'sinh6', 'sinh7', 'sinh8', 'sinh9', 'sinh10', 'sinh11', 'sinh12']
      },
      {
        id: 'user_nexus_pre',
        username: 'nexuspre',
        email: 'nexuspre@nexus.edu.vn',
        password: hashPassword('0915903757'),
        name: 'Nexus Premium Member',
        role: 'premium',
        roleLabel: 'Thành viên Premium VIP',
        isAdmin: false,
        canDeleteComments: false,
        canDownloadPremium: true,
        grade: 'Khối Nghiên Cứu VIP',
        school: 'NEXUSLAB VIP Academy',
        avatar: '👑',
        xp: 50000,
        level: 'Premium VIP Scientist',
        badges: ['Thành viên Premium', 'Scanner Bản Quyền']
      },
      {
        id: 'user_nexus_ult',
        username: 'nexusult',
        email: 'nexusult@nexus.edu.vn',
        password: hashPassword('0915903757'),
        name: 'Nexus Ultimate Member',
        role: 'ultimate',
        roleLabel: 'Thành viên Ultimate VIP',
        isAdmin: false,
        canDeleteComments: false,
        canDownloadPremium: true,
        grade: 'Khối Đặc Quyền Ultimate',
        school: 'NEXUSLAB VIP Academy',
        avatar: '💎',
        xp: 80000,
        level: 'Ultimate VIP Scientist',
        badges: ['Thành viên Ultimate', 'Scanner Không Giới Hạn']
      }
    ];

    let dbUpdated = false;
    defaultPrivilegedAccounts.forEach(acc => {
      const idx = data.users.findIndex(u => 
        (u.username && u.username.toLowerCase() === acc.username.toLowerCase()) || 
        (u.email && u.email.toLowerCase() === acc.email.toLowerCase())
      );
      if (idx === -1) {
        data.users.push(acc);
        dbUpdated = true;
      }
    });

    if (dbUpdated) {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
    return data;
  } catch (err) {
    console.error('Error in loadDatabase:', err);
    return { users: [], reviews: [] };
  }
}

function saveDatabase(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error in saveDatabase:', err);
    return false;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sanitizeUser(u) {
  if (!u) return null;
  const clone = Object.assign({}, u);
  delete clone.password;
  return clone;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
  '.apk': 'application/vnd.android.package-archive',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.zip': 'application/zip'
};

const server = http.createServer(async (req, res) => {
  // Parse URL & prevent path traversal
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // -------------------------------------------------------------
  // REST API ROUTING (/api/...)
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-User, X-Admin-Pass');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const db = loadDatabase();

    // 1. GET /api/reviews
    if (pathname === '/api/reviews' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, reviews: db.reviews }));
    }

    // 2. POST /api/reviews (Thêm đánh giá mới, kiểm tra 1 tài khoản chỉ 1 lần)
    if (pathname === '/api/reviews' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const userId = (body.userId || '').trim();
      const userName = (body.userName || '').trim();
      const userIdentifier = (body.userIdentifier || userId || userName).toLowerCase().trim();

      if (!userId || !body.content || !body.rating) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, message: 'Thiếu nội dung đánh giá hoặc điểm số sao!' }));
      }

      // Ràng buộc: Mỗi người dùng chỉ được đánh giá 1 lần
      const hasReviewed = db.reviews.some(r => {
        if (r.userId && r.userId === userId) return true;
        if (userIdentifier && r.userIdentifier && r.userIdentifier === userIdentifier) return true;
        if (userName && r.userName && r.userName.toLowerCase() === userName.toLowerCase() && userId !== 'anonymous') return true;
        return false;
      });

      if (hasReviewed) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: false,
          message: 'Mỗi tài khoản người dùng chỉ được gửi đánh giá 1 lần để đảm bảo tính khách quan.'
        }));
      }

      const newReview = {
        id: 'rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        userId: userId,
        userName: userName || 'Người dùng NexusLab',
        userRole: body.userRole || 'Học sinh',
        userAvatar: body.userAvatar || '👨‍🎓',
        userIdentifier: userIdentifier,
        rating: Math.max(1, Math.min(5, parseInt(body.rating) || 5)),
        content: String(body.content || '').slice(0, 1000).trim(),
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 5) : [],
        createdAt: new Date().toISOString(),
        likes: 0
      };

      db.reviews.unshift(newReview);
      saveDatabase(db);

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        success: true,
        review: newReview,
        message: 'Gửi đánh giá và nhận xét thành công! Cảm ơn bạn.'
      }));
    }

    // 3. DELETE /api/reviews/:id (Chỉ tài khoản adminnexus pass: 04082012 mới có quyền xóa)
    if (pathname.startsWith('/api/reviews/') && req.method === 'DELETE') {
      const reviewId = pathname.replace('/api/reviews/', '').trim();
      const body = await parseJsonBody(req);

      const adminUser = (body.adminUser || req.headers['x-admin-user'] || '').trim().toLowerCase();
      const adminPass = body.adminPass || req.headers['x-admin-pass'] || '';

      const isAdmin = ((adminUser === 'adminnexus' || adminUser === 'nexusadmin') && adminPass === '04082012') ||
                      ((adminUser === 'adminnexus' || adminUser === 'nexusadmin') && hashPassword(adminPass) === hashPassword('04082012'));

      if (!isAdmin) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: false,
          message: 'Quyền bị từ chối: Chỉ tài khoản Quản trị viên tối cao (adminnexus) mới có quyền xóa comment!'
        }));
      }

      const initialCount = db.reviews.length;
      db.reviews = db.reviews.filter(r => r.id !== reviewId);

      if (db.reviews.length === initialCount) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, message: 'Không tìm thấy đánh giá cần xóa.' }));
      }

      saveDatabase(db);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        success: true,
        message: 'Đã xóa comment thành công (Quyền Quản trị viên adminnexus).'
      }));
    }

    // 4. POST /api/reviews/like
    if (pathname === '/api/reviews/like' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const review = db.reviews.find(r => r.id === body.reviewId);
      if (review) {
        review.likes = (review.likes || 0) + 1;
        saveDatabase(db);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, likes: review.likes }));
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, message: 'Không tìm thấy đánh giá.' }));
    }

    // 5. POST /api/auth/register (Lưu tài khoản người dùng vào database server)
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const identifier = (body.username || body.email || '').trim().toLowerCase();
      const rawPassword = body.password || '';

      if (!identifier || !rawPassword || !body.name) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, message: 'Thiếu thông tin đăng ký!' }));
      }

      const exists = db.users.some(u => 
        (u.username && u.username.toLowerCase() === identifier) ||
        (u.email && u.email.toLowerCase() === identifier)
      );

      if (exists) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, message: 'Tên đăng nhập hoặc Email này đã tồn tại!' }));
      }

      const newUser = {
        id: 'user_' + Date.now(),
        username: body.username ? body.username.trim() : identifier.split('@')[0],
        email: body.email ? body.email.trim().toLowerCase() : `${identifier}@nexus.edu.vn`,
        password: hashPassword(rawPassword),
        name: String(body.name || '').trim(),
        role: body.role === 'teacher' ? 'teacher' : 'student',
        roleLabel: body.role === 'teacher' ? 'Giáo viên' : 'Học sinh',
        grade: body.grade || 'Lớp 9',
        school: body.school || 'Trường THCS / THPT',
        avatar: body.avatar || (body.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'),
        xp: 200,
        level: 'Level 1 - Thành Viên Mới',
        badges: ['Tân Binh Phòng Lab'],
        completedLabs: [],
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      saveDatabase(db);

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        success: true,
        user: sanitizeUser(newUser),
        message: 'Đăng ký tài khoản thành công và đã lưu trữ vào cơ sở dữ liệu!'
      }));
    }

    // 6. POST /api/auth/login (Xác thực đăng nhập từ database)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const identifier = (body.identifier || body.email || body.username || '').trim().toLowerCase();
      const inputPass = body.password || '';
      const hashedInput = hashPassword(inputPass);

      const user = db.users.find(u => {
        const usernameMatch = u.username && u.username.toLowerCase() === identifier;
        const emailMatch = u.email && u.email.toLowerCase() === identifier;
        if (!usernameMatch && !emailMatch) return false;
        return u.password === hashedInput || u.password === inputPass;
      });

      if (user) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          user: sanitizeUser(user),
          message: 'Đăng nhập thành công từ cơ sở dữ liệu!'
        }));
      }

      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' }));
    }

    // 7. GET /api/auth/users
    if (pathname === '/api/auth/users' && req.method === 'GET') {
      const safeUsers = db.users.map(sanitizeUser);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, users: safeUsers }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: false, message: 'API endpoint not found' }));
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING
  // -------------------------------------------------------------
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const safePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden: Access denied');
  }

  // Security: Deny direct public access to sensitive files, hidden directories, database and credentials
  const baseName = path.basename(safePath).toLowerCase();
  const relPath = path.relative(ROOT_DIR, safePath).replace(/\\/g, '/');
  const isBlocked = 
    baseName.startsWith('.') || 
    baseName === 'api.txt' || 
    baseName === 'server.js' || 
    baseName === 'package.json' || 
    baseName === 'package-lock.json' ||
    baseName === 'database.json' ||
    relPath.startsWith('data/') ||
    relPath.startsWith('.git') ||
    relPath.startsWith('.next') ||
    relPath.startsWith('src/') ||
    relPath.includes('..');

  if (isBlocked) {
    res.writeHead(403, { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    return res.end('403 Forbidden: Access to sensitive file is denied.');
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN'
      });
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>404 Not Found - NexusLab</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #040711; color: #fff;">
          <h1 style="color: #06b6d4; font-size: 48px;">404</h1>
          <p>Không tìm thấy trang: <code>${pathname}</code></p>
          <a href="/index.html" style="color: #10b981; font-weight: bold; text-decoration: none;">&larr; Về Trang Chủ NexusLab</a>
        </body>
        </html>
      `);
    }

    let filePathToServe = safePath;
    if (stats.isDirectory()) {
      filePathToServe = path.join(safePath, 'index.html');
    }

    const ext = path.extname(filePathToServe).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePathToServe, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('500 Internal Server Error: ' + readErr.message);
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://generativelanguage.googleapis.com https://api.openai.com https://api.xkiro.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com https://api.xkiro.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
      });
      res.end(content);
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.log(`Port ${PORT} đang bận, tự động chuyển sang port ${nextPort}...`);
    server.listen(nextPort);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  const actualPort = server.address().port;
  console.log(`
  ==============================================================
   🚀 NEXUSLAB VIRTUAL SCIENCE SUITE - LOCAL SERVER IS RUNNING
  ==============================================================
   - Cổng Chính (Home):       http://localhost:${actualPort}/index.html
   - Cổng Vật Lý (Physics):   http://localhost:${actualPort}/ly.html
   - Cổng Hóa Học (Chemistry): http://localhost:${actualPort}/hoa.html
   - Cổng Sinh Học (Biology):  http://localhost:${actualPort}/sinh.html
   --------------------------------------------------------------
   🎮 PHÒNG THÍ NGHIỆM TỰ DO (NEXUSLAB SANDBOX):
   - Sandbox Vật Lý:          http://localhost:${actualPort}/lysand.html
   - Sandbox Hóa Học:         http://localhost:${actualPort}/hoasand.html
   - Sandbox Sinh Học:        http://localhost:${actualPort}/sinhsand.html
   --------------------------------------------------------------
   👨‍🏫 CHẾ ĐỘ GIẢNG DẠY (TEACHER TOOLKIT):
   - Nhấn icon 👨‍🏫 (góc dưới phải) trên bất kỳ trang nào để mở:
     + Bút vẽ màn hình & Laser Pointer
     + Thẻ tra cứu công thức SGK GDPT 2018
     + Trắc nghiệm tương tác lớp học
     + Điều khiển tốc độ thời gian 0.25x / 0.5x / Step
  ==============================================================
  `);
});

module.exports = server;
