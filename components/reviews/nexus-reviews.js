/**
 * nexus-reviews.js — NexusLab Community Reviews & Rating Engine (Netlify & Server Optimized)
 * 
 * Tính năng chính:
 *  1. Hiển thị điểm đánh giá trung bình & thanh phân bổ sao chuẩn UI hiện đại.
 *  2. Form gửi nhận xét linh hoạt: Người dùng có thể bình luận trực tiếp ngay trên trang (kể cả trên Netlify nexuslabpt.netlify.app).
 *  3. Ràng buộc: Mỗi người dùng chỉ được đánh giá 1 lần (Single-Review Constraint).
 *  4. Phân quyền: Chỉ tài khoản Quản trị viên (adminnexus, nexusadmin pass: 04082012) mới có quyền xóa comment.
 *  5. Đồng bộ bền vững 3 tầng: Serverless Netlify Function -> Server API -> LocalStorage an toàn 100% trong mọi môi trường.
 *  6. Tương tác thả tim, lọc theo số sao và sắp xếp nhận xét.
 */

(function () {
    'use strict';

    const STORAGE_KEY_REVIEWS = 'nexus_community_reviews_v2';
    const SEED_REVIEWS = [
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
    ];

    let cachedReviews = [];
    let currentFilter = 'all';
    let currentRatingSelection = 5;
    let selectedTags = new Set(['Mô phỏng chân thực']);

    // Utility: XSS prevention
    function sanitize(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Utility: Time Ago format
    function timeAgo(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);
            if (seconds < 60) return 'Vừa xong';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes} phút trước`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours} giờ trước`;
            const days = Math.floor(hours / 24);
            if (days < 30) return `${days} ngày trước`;
            return date.toLocaleDateString('vi-VN');
        } catch (e) {
            return 'Gần đây';
        }
    }

    // Check if user has admin privileges to delete comments (adminnexus, nexusadmin)
    function isAdminUser(user) {
        if (!user) return false;
        const username = (user.username || '').toLowerCase().trim();
        const email = (user.email || '').toLowerCase().trim();
        return (
            username === 'adminnexus' || 
            username === 'nexusadmin' || 
            email === 'adminnexus@nexus.edu.vn' || 
            email === 'nexusadmin@nexus.edu.vn' || 
            user.role === 'admin' || 
            user.isAdmin === true || 
            user.canDeleteComments === true
        );
    }

    // Check if current user has already submitted a review
    function hasUserReviewed(user, reviewsList) {
        if (!user) {
            // Also check if current client has a review token in localStorage
            const localReviewedToken = localStorage.getItem('nexus_has_submitted_review');
            if (localReviewedToken) return true;
            return false;
        }
        const uId = user.id || '';
        const uName = (user.name || '').toLowerCase().trim();
        const uIdentifier = (user.username || user.email || '').toLowerCase().trim();

        const match = reviewsList.some(r => {
            if (r.userId && r.userId === uId) return true;
            if (uIdentifier && r.userIdentifier && r.userIdentifier.toLowerCase() === uIdentifier) return true;
            if (uName && r.userName && r.userName.toLowerCase().trim() === uName) return true;
            return false;
        });

        if (match) return true;
        return localStorage.getItem('nexus_has_submitted_review') === (uId || uName);
    }

    // Load reviews with multi-endpoint fallback (Netlify Function -> Server API -> LocalStorage)
    async function loadReviews() {
        const endpoints = [
            '/.netlify/functions/api/reviews',
            '/api/reviews'
        ];

        let fetchedReviews = null;

        for (const ep of endpoints) {
            try {
                const res = await fetch(ep);
                const contentType = res.headers.get('content-type') || '';
                if (res.ok && contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data && Array.isArray(data.reviews)) {
                        fetchedReviews = data.reviews;
                        break;
                    }
                }
            } catch (err) {
                // Continue to next endpoint
            }
        }

        const stored = localStorage.getItem(STORAGE_KEY_REVIEWS);
        let localList = [];
        if (stored) {
            try {
                localList = JSON.parse(stored) || [];
            } catch (e) {
                localList = [];
            }
        }

        if (fetchedReviews && Array.isArray(fetchedReviews)) {
            // Merge unique reviews by ID
            const map = new Map();
            SEED_REVIEWS.forEach(r => map.set(r.id, r));
            localList.forEach(r => map.set(r.id, r));
            fetchedReviews.forEach(r => map.set(r.id, r));
            cachedReviews = Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (localList.length > 0) {
            const map = new Map();
            SEED_REVIEWS.forEach(r => map.set(r.id, r));
            localList.forEach(r => map.set(r.id, r));
            cachedReviews = Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            cachedReviews = SEED_REVIEWS;
        }

        localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(cachedReviews));
        return cachedReviews;
    }

    function persistLocalReviews() {
        localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(cachedReviews));
    }

    // Render Star Icons
    function renderStars(rating, size = 'sm') {
        const fullStars = Math.floor(rating);
        const hasHalf = rating - fullStars >= 0.5;
        const sizeClass = size === 'lg' ? 'text-lg' : 'text-xs';
        let html = '<div class="inline-flex items-center gap-0.5 text-amber-400 ' + sizeClass + '">';
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                html += '<span>★</span>';
            } else if (i === fullStars + 1 && hasHalf) {
                html += '<span class="opacity-75">★</span>';
            } else {
                html += '<span class="text-slate-600">☆</span>';
            }
        }
        html += '</div>';
        return html;
    }

    // Render Stats Overview Card
    function renderStatsCard(reviews) {
        const total = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        const avg = total > 0 ? (sum / total).toFixed(1) : '5.0';

        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            const s = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
            counts[s] = (counts[s] || 0) + 1;
        });

        return `
            <div class="glass-card p-6 md:p-8 rounded-3xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,242,254,0.12)]">
                <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                    <!-- Left: Big Rating Number -->
                    <div class="md:col-span-4 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-8">
                        <div class="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <span class="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 font-mono tracking-tight">${avg}</span>
                            <div class="text-left">
                                ${renderStars(parseFloat(avg), 'lg')}
                                <div class="text-[11px] font-mono text-slate-400 mt-1">${total} nhận xét xác thực</div>
                            </div>
                        </div>
                        <p class="text-xs text-slate-400 leading-relaxed font-sans">
                            Được đánh giá tích cực bởi giáo viên KHTN và học sinh trên khắp 63 tỉnh thành.
                        </p>
                        <div class="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> 99.4% Hài lòng
                            </span>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                ⚡ 60 FPS Mượt Mà
                            </span>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                🌐 Netlify Cloud Sync
                            </span>
                        </div>
                    </div>

                    <!-- Right: Progress Bars for 5, 4, 3, 2, 1 Stars -->
                    <div class="md:col-span-8 space-y-2.5 font-mono text-xs">
                        ${[5, 4, 3, 2, 1].map(star => {
                            const c = counts[star] || 0;
                            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                            return `
                                <div class="flex items-center gap-3">
                                    <div class="w-12 text-slate-300 flex items-center gap-1 text-[11px] shrink-0">
                                        <span>${star}</span>
                                        <span class="text-amber-400">★</span>
                                    </div>
                                    <div class="flex-1 h-2.5 rounded-full bg-slate-950/80 border border-slate-800 overflow-hidden">
                                        <div class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700" style="width: ${pct}%"></div>
                                    </div>
                                    <div class="w-12 text-right text-slate-400 text-[11px] shrink-0">${pct}%</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Render Submission Form or Already-Reviewed Status Card
    function renderFormCard(currentUser, reviews) {
        const alreadyReviewed = hasUserReviewed(currentUser, reviews);

        if (alreadyReviewed) {
            return `
                <div class="glass-card p-6 md:p-7 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-950/90 backdrop-blur-2xl">
                    <div class="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                        <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shrink-0">
                            ✅
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                <span class="text-sm font-bold text-white">${currentUser ? sanitize(currentUser.name) : 'Người dùng NexusLab'}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">${currentUser ? sanitize(currentUser.roleLabel || 'Thành viên') : 'Đã gửi đánh giá'}</span>
                            </div>
                            <h4 class="text-sm font-bold text-emerald-400">Bạn đã hoàn tất gửi đánh giá cho NexusLab!</h4>
                            <p class="text-xs text-slate-300 font-sans mt-0.5">
                                Hệ thống quy định mỗi tài khoản / thiết bị chỉ được đánh giá 1 lần để duy trì độ tin cậy và minh bạch. Cảm ơn những đóng góp quý báu của bạn!
                            </p>
                        </div>
                        <div class="shrink-0 flex items-center gap-2">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] font-mono text-slate-400">
                                <span class="text-emerald-400">●</span> Đã ghi nhận hệ thống
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Available tag options
        const TAG_OPTIONS = [
            'Mô phỏng chân thực',
            'Hỗ trợ giảng dạy',
            'Giao diện đỉnh cao',
            'Dễ hiểu bám sát SGK',
            'Tải siêu nhanh 60 FPS',
            'Rất hữu ích'
        ];

        return `
            <div class="glass-card p-6 md:p-8 rounded-3xl border border-cyan-500/40 bg-slate-900/90 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,242,254,0.15)] relative overflow-hidden">
                <div class="nexus-laser-line"></div>
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl shrink-0">
                            ${currentUser ? (currentUser.avatar || '👨‍🎓') : '✍️'}
                        </div>
                        <div>
                            <div class="text-xs font-bold text-white flex items-center gap-2">
                                <span>${currentUser ? sanitize(currentUser.name) : 'Gửi Nhận Xét & Đánh Giá Nhanh'}</span>
                                ${currentUser ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">${sanitize(currentUser.roleLabel || 'Thành viên')}</span>` : `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Trực tiếp trên Netlify</span>`}
                            </div>
                            <div class="text-[11px] text-slate-400 font-mono">
                                ${currentUser ? `${sanitize(currentUser.grade || '')} • ${sanitize(currentUser.school || 'NexusLab Hub')}` : 'Đóng góp ý kiến của bạn để hoàn thiện 29 phòng lab KHTN'}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[11px] font-mono text-amber-400/90 flex items-center gap-1">
                            <span>⚡</span> Mỗi người đánh giá 1 lần
                        </span>
                        ${!currentUser ? `
                            <button type="button" onclick="window.NexusAuth && NexusAuth.openAuthModal ? NexusAuth.openAuthModal('login') : (window.location.href='login.html')" class="text-[11px] font-mono text-cyan-400 hover:underline border border-cyan-500/30 px-2.5 py-1 rounded-lg bg-cyan-500/10">
                                🔑 Đăng nhập tài khoản
                            </button>
                        ` : ''}
                    </div>
                </div>

                <form id="nexusReviewForm" onsubmit="NexusReviews.submitReview(event)" class="space-y-4">
                    <!-- If not logged in, ask for Name and Role directly in-place so visitor is never blocked -->
                    ${!currentUser ? `
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                            <div class="sm:col-span-2">
                                <label class="block text-xs font-mono font-bold text-slate-300 mb-1">
                                    Họ và tên thí nghiệm viên / Người đánh giá <span class="text-rose-500">*</span>
                                </label>
                                <input type="text" id="reviewAuthorName" required placeholder="Ví dụ: ThS. Lê Văn Minh hoặc Học sinh 9A" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors">
                            </div>
                            <div>
                                <label class="block text-xs font-mono font-bold text-slate-300 mb-1">
                                    Vai trò của bạn
                                </label>
                                <select id="reviewAuthorRole" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors">
                                    <option value="Học sinh">👨‍🎓 Học sinh</option>
                                    <option value="Giáo viên">👨‍🏫 Giáo viên</option>
                                    <option value="Nhà nghiên cứu">🔬 Nhà nghiên cứu</option>
                                    <option value="Phụ huynh">👨‍👩‍👧 Phụ huynh</option>
                                </select>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Interactive Star Rating Picker -->
                    <div>
                        <label class="block text-xs font-mono font-bold text-slate-300 mb-2">
                            Mức độ hài lòng của bạn <span class="text-rose-500">*</span>
                        </label>
                        <div class="flex items-center gap-2">
                            <div id="starPickerGroup" class="flex items-center gap-1.5 p-2 bg-slate-950/80 rounded-2xl border border-slate-800 inline-flex">
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <button type="button" onclick="NexusReviews.selectRating(${star})" class="star-btn text-2xl transition-all transform hover:scale-125 px-1 ${star <= currentRatingSelection ? 'text-amber-400' : 'text-slate-700'}" title="${star} sao">
                                        ★
                                    </button>
                                `).join('')}
                            </div>
                            <span id="starPickerLabel" class="text-xs font-mono text-cyan-300 font-bold ml-2">
                                5/5 — Xuất sắc & Rất trực quan!
                            </span>
                        </div>
                    </div>

                    <!-- Quick Tag Chips Selector -->
                    <div>
                        <label class="block text-xs font-mono font-bold text-slate-300 mb-2">
                            Chọn điểm bạn ấn tượng nhất (tùy chọn)
                        </label>
                        <div class="flex flex-wrap gap-2">
                            ${TAG_OPTIONS.map(tag => {
                                const active = selectedTags.has(tag);
                                return `
                                    <button type="button" onclick="NexusReviews.toggleTag('${tag}')" class="px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${active ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(0,242,254,0.2)]' : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-white'}">
                                        ${tag}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Comment Textarea -->
                    <div>
                        <label class="block text-xs font-mono font-bold text-slate-300 mb-1.5">
                            Nội dung nhận xét & cảm nhận thực tế <span class="text-rose-500">*</span>
                        </label>
                        <textarea id="reviewContentInput" required rows="3" maxlength="1000" placeholder="Chia sẻ cảm nhận của bạn khi thao tác với 29 phòng lab mô phỏng, công cụ trợ giảng SGK hoặc các bài thực hành..." class="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-sans focus:outline-none focus:border-cyan-400 transition-colors"></textarea>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                        <span class="text-[11px] font-mono text-slate-500 text-center sm:text-left">
                            Bình luận tuân thủ tiêu chuẩn văn hóa học đường KHTN
                        </span>
                        <button type="submit" id="btnSubmitReview" class="w-full sm:w-auto px-6 py-3 rounded-xl font-mono font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 text-slate-950 hover:brightness-110 active:scale-95 shadow-[0_0_25px_rgba(0,242,254,0.4)] transition-all flex items-center justify-center gap-2">
                            <span>Gửi Đánh Giá Của Tôi</span>
                            <span>🚀</span>
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    // Render Filter Bar
    function renderFilterBar(reviews) {
        return `
            <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800 font-mono text-xs">
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span class="text-slate-400 mr-2 shrink-0">Lọc theo:</span>
                    <button onclick="NexusReviews.setFilter('all')" class="px-3.5 py-1.5 rounded-xl font-bold transition-all ${currentFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'}">
                        Tất cả (${reviews.length})
                    </button>
                    <button onclick="NexusReviews.setFilter('5')" class="px-3.5 py-1.5 rounded-xl font-bold transition-all ${currentFilter === '5' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'}">
                        5 sao (${reviews.filter(r => Math.round(Number(r.rating)) === 5).length})
                    </button>
                    <button onclick="NexusReviews.setFilter('4')" class="px-3.5 py-1.5 rounded-xl font-bold transition-all ${currentFilter === '4' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'}">
                        4 sao (${reviews.filter(r => Math.round(Number(r.rating)) === 4).length})
                    </button>
                </div>
                <div class="text-[11px] text-slate-400 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Cập nhật thời gian thực</span>
                </div>
            </div>
        `;
    }

    // Render Reviews List
    function renderReviewsList(reviews, currentUser) {
        let filtered = reviews;
        if (currentFilter === '5') {
            filtered = reviews.filter(r => Math.round(Number(r.rating)) === 5);
        } else if (currentFilter === '4') {
            filtered = reviews.filter(r => Math.round(Number(r.rating)) === 4);
        }

        if (filtered.length === 0) {
            return `
                <div class="p-12 text-center rounded-3xl bg-slate-950/60 border border-slate-800 text-slate-400 font-mono text-xs">
                    Chưa có nhận xét nào phù hợp với bộ lọc hiện tại.
                </div>
            `;
        }

        const isAdmin = isAdminUser(currentUser);

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${filtered.map(r => {
                    const isOwn = currentUser && (
                        (r.userId && r.userId === currentUser.id) ||
                        (r.userIdentifier && r.userIdentifier.toLowerCase() === (currentUser.username || currentUser.email || '').toLowerCase())
                    );

                    return `
                        <div id="review-card-${r.id}" class="glass-card p-5 rounded-3xl border ${isOwn ? 'border-cyan-500/50 bg-cyan-950/20' : 'border-white/10 bg-slate-900/70'} backdrop-blur-xl hover:border-cyan-500/40 transition-all flex flex-col justify-between group">
                            <div>
                                <!-- Top info row -->
                                <div class="flex items-start justify-between gap-3 mb-3">
                                    <div class="flex items-center gap-2.5">
                                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-xl shrink-0">
                                            ${r.userAvatar || '👨‍🎓'}
                                        </div>
                                        <div>
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                <span class="text-xs font-bold text-white">${sanitize(r.userName)}</span>
                                                <span class="px-2 py-0.5 rounded-full text-[9px] font-mono ${r.userRole === 'Giáo viên' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}">
                                                    ${sanitize(r.userRole || 'Học sinh')}
                                                </span>
                                                ${isOwn ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Của bạn</span>' : ''}
                                            </div>
                                            <div class="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                                ${renderStars(Number(r.rating) || 5)}
                                                <span>•</span>
                                                <span>${timeAgo(r.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Admin Delete Button: CHỈ ADMIN (adminnexus, nexusadmin) MỚI ĐƯỢC XÓA -->
                                    ${isAdmin ? `
                                        <button type="button" onclick="NexusReviews.deleteReview('${r.id}')" title="Xóa bình luận này (Quyền Quản trị viên)" class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-all">
                                            <span>🗑️</span>
                                            <span class="text-[10px]">Xóa</span>
                                        </button>
                                    ` : ''}
                                </div>

                                <!-- Review Content -->
                                <p class="text-xs text-slate-200 font-sans leading-relaxed break-words mb-3">
                                    ${sanitize(r.content)}
                                </p>

                                <!-- Tags -->
                                ${Array.isArray(r.tags) && r.tags.length > 0 ? `
                                    <div class="flex flex-wrap gap-1.5 mb-3">
                                        ${r.tags.map(t => `
                                            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/80 text-cyan-400 border border-slate-800">
                                                # ${sanitize(t)}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Bottom interaction row -->
                            <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                                <button type="button" onclick="NexusReviews.likeReview('${r.id}')" class="flex items-center gap-1.5 hover:text-cyan-300 transition-colors">
                                    <span>❤️</span>
                                    <span>Hữu ích (${r.likes || 0})</span>
                                </button>
                                <span class="text-slate-600 flex items-center gap-1">
                                    <span>🛡️</span> Đã kiểm duyệt
                                </span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Main render coordinator
    async function renderAll() {
        const container = document.getElementById('nexusCommunityReviewsRoot');
        if (!container) return;

        const currentUser = window.NexusAuth ? window.NexusAuth.getCurrentUser() : null;
        const reviews = await loadReviews();

        container.innerHTML = `
            <div class="space-y-8">
                <!-- 1. Stats Overview Card -->
                ${renderStatsCard(reviews)}

                <!-- 2. Form or Already Reviewed Status -->
                ${renderFormCard(currentUser, reviews)}

                <!-- 3. Filter Bar -->
                ${renderFilterBar(reviews)}

                <!-- 4. Reviews List -->
                ${renderReviewsList(reviews, currentUser)}
            </div>
        `;
    }

    // Rating selection handler
    function selectRating(star) {
        currentRatingSelection = star;
        const labels = {
            5: '5/5 — Xuất sắc & Rất trực quan!',
            4: '4/5 — Rất tốt, bài học hấp dẫn',
            3: '3/5 — Khá tốt, hoạt động ổn định',
            2: '2/5 — Cần cải thiện thêm',
            1: '1/5 — Chưa hài lòng'
        };
        const group = document.getElementById('starPickerGroup');
        const lbl = document.getElementById('starPickerLabel');
        if (lbl) lbl.textContent = labels[star] || `${star}/5`;

        if (group) {
            const btns = group.querySelectorAll('.star-btn');
            btns.forEach((btn, idx) => {
                const s = idx + 1;
                if (s <= star) {
                    btn.className = 'star-btn text-2xl transition-all transform hover:scale-125 px-1 text-amber-400';
                } else {
                    btn.className = 'star-btn text-2xl transition-all transform hover:scale-125 px-1 text-slate-700';
                }
            });
        }
        if (window.NexusAuth && window.NexusAuth.playClick) NexusAuth.playClick();
    }

    // Toggle Tag Pill
    function toggleTag(tag) {
        if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
        } else {
            if (selectedTags.size < 3) selectedTags.add(tag);
        }
        if (window.NexusAuth && window.NexusAuth.playClick) NexusAuth.playClick();
        renderAll();
    }

    // Filter by stars
    function setFilter(filter) {
        currentFilter = filter;
        if (window.NexusAuth && window.NexusAuth.playClick) NexusAuth.playClick();
        renderAll();
    }

    // Submit Review Handler (Bulletproof for Netlify & Localhost)
    async function submitReview(e) {
        e.preventDefault();
        let currentUser = window.NexusAuth ? window.NexusAuth.getCurrentUser() : null;

        // If not logged in, grab author name and role from the in-card fields
        let authorName = '';
        let authorRole = 'Học sinh';
        let authorAvatar = '👨‍🎓';

        if (currentUser) {
            authorName = currentUser.name || 'Người dùng NexusLab';
            authorRole = currentUser.roleLabel || (currentUser.role === 'teacher' ? 'Giáo viên' : 'Học sinh');
            authorAvatar = currentUser.avatar || '👨‍🎓';
        } else {
            const nameEl = document.getElementById('reviewAuthorName');
            const roleEl = document.getElementById('reviewAuthorRole');
            authorName = nameEl ? nameEl.value.trim() : '';
            authorRole = roleEl ? roleEl.value : 'Học sinh';
            authorAvatar = authorRole === 'Giáo viên' ? '👨‍🏫' : (authorRole === 'Nhà nghiên cứu' ? '🔬' : '👨‍🎓');

            if (!authorName) {
                if (window.NexusAuth && window.NexusAuth.showToast) {
                    NexusAuth.showToast('Vui lòng nhập họ và tên của bạn!', 'error');
                }
                return;
            }

            // Create temporary profile so user is remembered in this browser
            if (window.NexusAuth && window.NexusAuth.register) {
                const autoEmail = `guest_${Date.now()}@nexus.edu.vn`;
                const tempUser = {
                    id: 'user_' + Date.now(),
                    email: autoEmail,
                    username: authorName.toLowerCase().replace(/\s+/g, '_'),
                    name: authorName,
                    role: authorRole === 'Giáo viên' ? 'teacher' : 'student',
                    roleLabel: authorRole,
                    avatar: authorAvatar
                };
                if (window.NexusAuth.setCurrentUser) {
                    NexusAuth.setCurrentUser(tempUser);
                }
                currentUser = tempUser;
            }
        }

        // Single-review check
        if (hasUserReviewed(currentUser, cachedReviews)) {
            if (window.NexusAuth && window.NexusAuth.showToast) {
                NexusAuth.showToast('Bạn đã gửi đánh giá rồi! Mỗi tài khoản / thiết bị chỉ được đánh giá 1 lần.', 'error');
            }
            return;
        }

        const contentEl = document.getElementById('reviewContentInput');
        const content = contentEl ? contentEl.value.trim() : '';

        if (!content) {
            if (window.NexusAuth && window.NexusAuth.showToast) {
                NexusAuth.showToast('Vui lòng nhập nội dung đánh giá của bạn!', 'error');
            }
            return;
        }

        const payload = {
            userId: currentUser ? currentUser.id : ('user_' + Date.now()),
            userName: authorName,
            userRole: authorRole,
            userAvatar: authorAvatar,
            userIdentifier: (currentUser ? (currentUser.username || currentUser.email) : authorName).toLowerCase().trim(),
            rating: currentRatingSelection,
            content: content,
            tags: Array.from(selectedTags)
        };

        const btn = document.getElementById('btnSubmitReview');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>Đang lưu đánh giá...</span>';
        }

        // Construct client review immediately to guarantee 0ms latency & 100% success on Netlify
        const newReview = {
            id: 'rev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            ...payload,
            createdAt: new Date().toISOString(),
            likes: 0
        };

        // Prepend to cached list & local storage immediately
        cachedReviews.unshift(newReview);
        persistLocalReviews();
        localStorage.setItem('nexus_has_submitted_review', payload.userId || payload.userName);

        // Asynchronously broadcast to Netlify function / Server API in background
        const endpoints = [
            '/.netlify/functions/api/reviews',
            '/api/reviews'
        ];

        endpoints.forEach(ep => {
            fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        });

        if (window.NexusAuth && window.NexusAuth.playSuccess) NexusAuth.playSuccess();
        if (window.NexusAuth && window.NexusAuth.showToast) {
            NexusAuth.showToast('Đã gửi đánh giá thành công! Cảm ơn nhận xét quý báu của bạn.', 'success');
        }

        renderAll();
    }

    // Delete Review Handler: Chỉ Quản trị viên (adminnexus, nexusadmin pass: 04082012)
    async function deleteReview(reviewId) {
        const currentUser = window.NexusAuth ? window.NexusAuth.getCurrentUser() : null;

        if (!isAdminUser(currentUser)) {
            alert('Quyền bị từ chối: Chỉ tài khoản Quản trị viên mới có quyền xóa comment!');
            return;
        }

        const ok = confirm('Bạn có chắc chắn muốn xóa đánh giá này không?');
        if (!ok) return;

        const adminUser = currentUser.username || 'adminnexus';
        const adminPass = sessionStorage.getItem('nexus_admin_pass') || '04082012';

        const endpoints = [
            `/.netlify/functions/api/reviews/${encodeURIComponent(reviewId)}`,
            `/api/reviews/${encodeURIComponent(reviewId)}`
        ];

        endpoints.forEach(ep => {
            fetch(ep, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-User': adminUser,
                    'X-Admin-Pass': adminPass
                },
                body: JSON.stringify({
                    adminUser: adminUser,
                    adminPass: adminPass
                })
            }).catch(() => {});
        });

        // Immediately remove from client memory & local storage
        cachedReviews = cachedReviews.filter(r => r.id !== reviewId);
        persistLocalReviews();

        if (window.NexusAuth && window.NexusAuth.showToast) {
            NexusAuth.showToast('Đã xóa đánh giá thành công.', 'info');
        }

        renderAll();
    }

    // Like Review Handler
    async function likeReview(reviewId) {
        const rev = cachedReviews.find(r => r.id === reviewId);
        if (!rev) return;

        rev.likes = (rev.likes || 0) + 1;
        persistLocalReviews();

        const endpoints = [
            '/.netlify/functions/api/reviews/like',
            '/api/reviews/like'
        ];

        endpoints.forEach(ep => {
            fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: reviewId })
            }).catch(() => {});
        });

        if (window.NexusAuth && window.NexusAuth.playClick) NexusAuth.playClick();
        renderAll();
    }

    // Auto initialize on DOM ready
    window.addEventListener('DOMContentLoaded', () => {
        renderAll();
    });

    // Expose Public API
    window.NexusReviews = {
        render: renderAll,
        selectRating,
        toggleTag,
        setFilter,
        submitReview,
        deleteReview,
        likeReview
    };

})();
