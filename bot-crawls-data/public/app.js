dayjs.locale('vi');
dayjs.extend(dayjs_plugin_relativeTime);

const { createApp } = Vue;

createApp({
  data() {
    return {
      activeTab: 'auction',
      stats: {},
      logs: [],
      recentAuctions: [],
      recentOrgSelections: [],
      loading: false,
      triggering: false,
      triggeringList: false,
      triggeringDuplicate: false,
      serverStatus: true,
      lastCrawlTime: null,
      // Detail modal
      isModalOpen: false,
      loadingDetail: false,
      selectedItem: null,
      selectedItemType: 'auction',
      // Duplicate modal
      isDuplicateModalOpen: false,
      loadingDuplicates: false,
      duplicates: [],
      duplicateType: 'all',
      duplicatePriceDrop: false,
      duplicateSort: 'updatedAt',
      duplicateSearch: '',
      duplicatePagination: { page: 1, limit: 15, total: 0, totalPages: 1 },
      // Pagination
      auctionsPagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
      orgPagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
    };
  },
  methods: {
    // ══ FORMAT ══
    formatMoney(val) {
      if (!val) return '—';
      if (val >= 1e9) return (val / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
      if (val >= 1e6) return (val / 1e6).toFixed(1).replace(/\.?0+$/, '') + ' tr';
      return new Intl.NumberFormat('vi-VN').format(val) + ' đ';
    },
    formatMoneyFull(val) {
      if (!val) return '—';
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
    },
    formatDate(d) { return d ? dayjs(d).format('HH:mm DD/MM/YYYY') : ''; },
    formatRelTime(d) { return d ? dayjs(d).fromNow() : ''; },
    formatShortDate(d) { return d ? dayjs(d).format('DD/MM/YY') : '—'; },

    // ══ DATA FETCHING ══
    async refreshData() {
      this.loading = true;
      try {
        const health = await fetch('/health');
        if (!health.ok) throw new Error();
        this.serverStatus = true;

        const [statsRes, logsRes] = await Promise.all([
          fetch('/api/auctions/stats'),
          fetch('/api/crawl-logs'),
        ]);
        this.stats = await statsRes.json();
        this.logs = await logsRes.json();
        if (this.logs.length > 0) this.lastCrawlTime = this.logs[0].finishedAt || this.logs[0].startedAt;

        await Promise.all([this.fetchAuctions(), this.fetchOrgSelections()]);
      } catch (err) {
        console.error(err);
        this.serverStatus = false;
      } finally {
        this.loading = false;
      }
    },

    async fetchAuctions() {
      try {
        const res = await fetch(`/api/auctions?limit=${this.auctionsPagination.limit}&page=${this.auctionsPagination.page}&sort=publishedAt&order=desc`);
        const data = await res.json();
        this.recentAuctions = data.items || [];
        this.auctionsPagination = { ...this.auctionsPagination, ...data.pagination };
      } catch (e) { console.error(e); }
    },

    async fetchOrgSelections() {
      try {
        const res = await fetch(`/api/org-selections?limit=${this.orgPagination.limit}&page=${this.orgPagination.page}`);
        const data = await res.json();
        this.recentOrgSelections = data.items || [];
        this.orgPagination = { ...this.orgPagination, ...data.pagination };
      } catch (e) { console.error(e); }
    },

    changeAuctionPage(p) {
      if (p >= 1 && p <= this.auctionsPagination.totalPages) {
        this.auctionsPagination.page = p;
        this.fetchAuctions();
      }
    },
    changeOrgPage(p) {
      if (p >= 1 && p <= this.orgPagination.totalPages) {
        this.orgPagination.page = p;
        this.fetchOrgSelections();
      }
    },

    // ══ DETAIL MODAL ══
    async viewDetail(type, id) {
      if (!id) return;
      this.selectedItemType = type;
      this.isModalOpen = true;
      this.loadingDetail = true;
      this.selectedItem = null;
      try {
        const endpoint = type === 'auction' ? `/api/auctions/${id}` : `/api/org-selections/${id}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data && !data.error) this.selectedItem = data;
        else { alert('Không lấy được thông tin'); this.closeModal(); }
      } catch (e) { alert('Lỗi: ' + e.message); this.closeModal(); }
      finally { this.loadingDetail = false; }
    },
    closeModal() { this.isModalOpen = false; this.selectedItem = null; },

    // ══ DUPLICATE MODAL ══
    openDuplicateModal(type) {
      this.duplicateType = type || 'all';
      this.duplicatePriceDrop = false;
      this.duplicateSort = 'updatedAt';
      this.duplicateSearch = '';
      this.duplicatePagination.page = 1;
      this.isDuplicateModalOpen = true;
      this.fetchDuplicates();
    },
    openPriceDropModal() {
      this.duplicateType = 'all';
      this.duplicatePriceDrop = true;
      this.duplicateSort = 'priceDropPercent';
      this.duplicateSearch = '';
      this.duplicatePagination.page = 1;
      this.isDuplicateModalOpen = true;
      this.fetchDuplicates();
    },
    closeDuplicateModal() { this.isDuplicateModalOpen = false; },

    async fetchDuplicates() {
      this.loadingDuplicates = true;
      try {
        let url = `/api/duplicates?limit=${this.duplicatePagination.limit}&page=${this.duplicatePagination.page}&sort=${this.duplicateSort}`;
        if (this.duplicateType !== 'all') url += `&type=${this.duplicateType}`;
        if (this.duplicatePriceDrop) url += '&priceDrop=true';
        if (this.duplicateSearch) url += `&search=${encodeURIComponent(this.duplicateSearch)}`;
        const res = await fetch(url);
        const data = await res.json();
        this.duplicates = data.items || [];
        this.duplicatePagination = { ...this.duplicatePagination, ...data.pagination };
      } catch (e) { console.error(e); }
      finally { this.loadingDuplicates = false; }
    },

    changeDupPage(p) {
      if (p >= 1 && p <= this.duplicatePagination.totalPages) {
        this.duplicatePagination.page = p;
        this.fetchDuplicates();
      }
    },

    applyDupFilter() {
      this.duplicatePagination.page = 1;
      this.fetchDuplicates();
    },

    // ══ TRIGGERS ══
    async triggerDetailCrawl(type = 'all') {
      const input = prompt('Số lượng bài cào chi tiết (mặc định 30):', '30');
      if (input === null) return;
      this.triggering = true;
      try {
        const res = await fetch('/api/trigger-detail-crawl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: parseInt(input) || 30, type }),
        });
        const data = await res.json();
        if (data.success) alert('Đã kích hoạt bot cào chi tiết!');
        setTimeout(() => this.refreshData(), 3000);
      } catch (e) { alert('Lỗi: ' + e.message); }
      finally { this.triggering = false; }
    },

    async triggerListCrawl(type = 'all') {
      const input = prompt('Số trang cào (mỗi trang ~20 bài, mặc định 5):', '5');
      if (input === null) return;
      this.triggeringList = true;
      try {
        const res = await fetch('/api/trigger-list-crawl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxPages: parseInt(input) || 5, type }),
        });
        const data = await res.json();
        if (data.success) alert('Đã kích hoạt bot cào danh sách!');
        setTimeout(() => this.refreshData(), 3000);
      } catch (e) { alert('Lỗi: ' + e.message); }
      finally { this.triggeringList = false; }
    },

    async triggerDuplicateScan() {
      if (!confirm('Quét toàn bộ DB tìm bài đăng trùng lặp?')) return;
      this.triggeringDuplicate = true;
      try {
        const res = await fetch('/api/trigger-duplicate-scan', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
      } catch (e) { alert('Lỗi: ' + e.message); }
      finally { this.triggeringDuplicate = false; }
    },

    // ══ HELPERS ══
    logTypeLabel(t) {
      const map = { auction_notice: 'DS Đấu Giá', org_selection: 'DS Tổ Chức', detail: 'Chi Tiết ĐG', org_detail: 'CT Tổ Chức' };
      return map[t] || t;
    },
    logTypeClass(t) {
      if (t === 'auction_notice' || t === 'detail') return 'tag-blue';
      if (t === 'org_selection' || t === 'org_detail') return 'tag-orange';
      return 'tag-muted';
    },
    logDuration(log) {
      if (!log.startedAt || !log.finishedAt) return '—';
      return Math.round((new Date(log.finishedAt) - new Date(log.startedAt)) / 1000) + 's';
    },
  },
  mounted() {
    this.refreshData();
    setInterval(() => this.refreshData(), 30000);
  },
}).mount('#app');
