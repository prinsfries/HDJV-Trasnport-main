const translations = {
  en: {
    app: {
      name: 'HDJV',
      subName: 'Driver System'
    },
    sidebar: {
      dashboard: 'Dashboard',
      users: 'Users',
      routes: 'Routes',
      vehicles: 'Vehicles',
      accounts: 'Accounts',
      requests: 'Requests',
      timeRecords: 'Time Records',
      reports: 'Reports',
      settings: 'Settings',
      expandSidebar: 'Expand sidebar',
      collapseSidebar: 'Collapse sidebar',
      expand: 'Expand',
      collapse: 'Collapse',
      userMenu: 'User menu',
      adminUser: 'Admin User',
      systemAdmin: 'System Admin',
      logout: 'Logout'
    },
    header: {
      defaultTitle: 'Dashboard',
      notifications: 'Notifications',
      markAllRead: 'Mark all read',
      noNotifications: 'No notifications yet.',
      loading: 'Loading...',
      noMoreNotifications: 'No more notifications',
      viewAll: 'View all'
    },
    pages: {
      dashboardOverview: 'Dashboard Overview',
      usersManagement: 'Users Management',
      routesManagement: 'Routes Management',
      vehiclesManagement: 'Vehicles Management',
      accountsManagement: 'Accounts Management',
      requestsManagement: 'Requests Management',
      reportsAnalytics: 'Reports & Analytics',
      driverTimeRecords: 'Driver Time Records',
      timeRecordsPerDay: 'Time Records Per Day',
      notifications: 'Notifications',
      settings: 'Settings'
    },
    settings: {
      title: 'Settings',
      dateTime: 'Date & Time',
      dateFormat: 'Date Format',
      timeFormat: 'Time Format',
      preview: 'Preview',
      previewAt: 'at',
      notifications: 'Notifications',
      enableNotifications: 'Enable notifications',
      notificationsDescription: 'Show browser alerts for new requests and updates. You can turn this off anytime.',
      saveSettings: 'Save Settings',
      saving: 'Saving...',
      resetDefaults: 'Reset to Defaults',
      missingUserInfo: 'Missing user information. Please sign in again.',
      settingsSaved: 'Settings saved successfully!',
      settingsSaveFailed: 'Failed to save settings. Please try again.',
      notificationsEnabled: 'Notifications enabled.',
      notificationsDisabled: 'Notifications disabled.',
      notificationsNotEnabled: 'Notifications were not enabled.',
      notificationsSaveFailed: 'Failed to save notification preference.',
      notificationsEnableFailed: 'Failed to enable notifications.',
      language: {
        title: 'Language',
        label: 'App Language',
        description: 'Choose the language used across the admin dashboard.',
        english: 'English',
        korean: '한국어'
      },
      dateFormatDescriptions: {
        '1': 'Month-Day-Year with leading zeros',
        '2': 'Day-Month-Year with leading zeros',
        '3': 'Year-Month-Day with leading zeros',
        '4': 'Month name-Day-Year with no leading zeros',
        '5': 'Month-Day-Year with no leading zeros',
        '6': 'Day-Month-Year with no leading zeros',
        '7': 'Year-Month-Day with no leading zeros',
        '8': 'Day-Month name-Year',
        '9': 'Year-Month name-Day',
        '10': 'Month abbreviation, Day with leading zeros, Year',
        '11': 'Day with leading zeros, Month abbreviation, Year',
        '12': 'Year, Month abbreviation, Day with leading zeros',
        '13': 'Month abbreviation, Day with leading zeros, Year',
        '14': 'Day with leading zeros, Month abbreviation, Year',
        '15': 'Year, Month abbreviation, Day with leading zeros'
      },
      timeFormatDescriptions: {
        '12': '12-hour format with AM/PM',
        '24': '24-hour format (military time)'
      },
      timeFormatLabels: {
        '12': '12-hour',
        '24': '24-hour'
      }
    },
    login: {
      signIn: 'Sign in',
      subtitle: 'Enter your credentials to continue.',
      email: 'Email address',
      emailPlaceholder: 'admin@hdjv.com',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      remember: 'Remember me',
      signingIn: 'Signing in...',
      needAccess: 'Need access? Contact the system admin.',
      loginFailed: 'Login failed. Please try again.'
    },
    notificationPrompt: {
      helpAria: 'Notification settings help',
      preferenceAria: 'Notification preference',
      blockedTitle: 'Notifications are blocked in your browser',
      blockedBody: 'You enabled notifications in Settings, but the browser has them blocked. Use the lock icon beside the address bar, set Notifications to Allow, then refresh the page.',
      dismiss: 'Dismiss',
      enableTitle: 'Enable notifications?',
      enableBody: 'Get alerts when requests are updated or assigned. You can change this later in Settings.',
      notNow: 'Not now',
      enable: 'Enable',
      enabling: 'Enabling...'
    }
  },
  ko: {
    app: {
      name: 'HDJV',
      subName: '드라이버 시스템'
    },
    sidebar: {
      dashboard: '대시보드',
      users: '사용자',
      routes: '노선',
      vehicles: '차량',
      accounts: '계정',
      requests: '요청',
      timeRecords: '근무 기록',
      reports: '보고서',
      settings: '설정',
      expandSidebar: '사이드바 펼치기',
      collapseSidebar: '사이드바 접기',
      expand: '펼치기',
      collapse: '접기',
      userMenu: '사용자 메뉴',
      adminUser: '관리자',
      systemAdmin: '시스템 관리자',
      logout: '로그아웃'
    },
    header: {
      defaultTitle: '대시보드',
      notifications: '알림',
      markAllRead: '모두 읽음',
      noNotifications: '아직 알림이 없습니다.',
      loading: '로딩 중...',
      noMoreNotifications: '더 이상 알림이 없습니다',
      viewAll: '모두 보기'
    },
    pages: {
      dashboardOverview: '대시보드 개요',
      usersManagement: '사용자 관리',
      routesManagement: '노선 관리',
      vehiclesManagement: '차량 관리',
      accountsManagement: '계정 관리',
      requestsManagement: '요청 관리',
      reportsAnalytics: '보고서 및 분석',
      driverTimeRecords: '운전자 근무 기록',
      timeRecordsPerDay: '일별 근무 기록',
      notifications: '알림',
      settings: '설정'
    },
    settings: {
      title: '설정',
      dateTime: '날짜 및 시간',
      dateFormat: '날짜 형식',
      timeFormat: '시간 형식',
      preview: '미리보기',
      previewAt: '에',
      notifications: '알림',
      enableNotifications: '알림 사용',
      notificationsDescription: '새 요청 및 업데이트에 대한 브라우저 알림을 표시합니다. 언제든지 끌 수 있습니다.',
      saveSettings: '설정 저장',
      saving: '저장 중...',
      resetDefaults: '기본값으로 재설정',
      missingUserInfo: '사용자 정보가 없습니다. 다시 로그인해 주세요.',
      settingsSaved: '설정이 저장되었습니다!',
      settingsSaveFailed: '설정을 저장하지 못했습니다. 다시 시도해 주세요.',
      notificationsEnabled: '알림이 활성화되었습니다.',
      notificationsDisabled: '알림이 비활성화되었습니다.',
      notificationsNotEnabled: '알림이 활성화되지 않았습니다.',
      notificationsSaveFailed: '알림 설정을 저장하지 못했습니다.',
      notificationsEnableFailed: '알림을 활성화하지 못했습니다.',
      language: {
        title: '언어',
        label: '앱 언어',
        description: '관리자 대시보드에서 사용할 언어를 선택하세요.',
        english: 'English',
        korean: '한국어'
      },
      dateFormatDescriptions: {
        '1': '월-일-연도(앞에 0 포함)',
        '2': '일-월-연도(앞에 0 포함)',
        '3': '연도-월-일(앞에 0 포함)',
        '4': '월 이름-일-연도(앞에 0 없음)',
        '5': '월-일-연도(앞에 0 없음)',
        '6': '일-월-연도(앞에 0 없음)',
        '7': '연도-월-일(앞에 0 없음)',
        '8': '일-월 이름-연도',
        '9': '연도-월 이름-일',
        '10': '월 약어, 앞에 0 포함된 일, 연도',
        '11': '앞에 0 포함된 일, 월 약어, 연도',
        '12': '연도, 월 약어, 앞에 0 포함된 일',
        '13': '월 약어, 앞에 0 포함된 일, 연도',
        '14': '앞에 0 포함된 일, 월 약어, 연도',
        '15': '연도, 월 약어, 앞에 0 포함된 일'
      },
      timeFormatDescriptions: {
        '12': '오전/오후 표기 12시간제',
        '24': '24시간제'
      },
      timeFormatLabels: {
        '12': '12시간제',
        '24': '24시간제'
      }
    },
    login: {
      signIn: '로그인',
      subtitle: '계속하려면 자격 증명을 입력하세요.',
      email: '이메일 주소',
      emailPlaceholder: 'admin@hdjv.com',
      password: '비밀번호',
      passwordPlaceholder: '비밀번호를 입력하세요',
      showPassword: '비밀번호 표시',
      hidePassword: '비밀번호 숨기기',
      remember: '로그인 상태 유지',
      signingIn: '로그인 중...',
      needAccess: '접근이 필요하신가요? 시스템 관리자에게 문의하세요.',
      loginFailed: '로그인에 실패했습니다. 다시 시도해 주세요.'
    },
    notificationPrompt: {
      helpAria: '알림 설정 도움말',
      preferenceAria: '알림 설정',
      blockedTitle: '브라우저에서 알림이 차단되었습니다',
      blockedBody: '설정에서 알림을 활성화했지만 브라우저에서 차단되어 있습니다. 주소창의 잠금 아이콘을 눌러 알림을 허용한 뒤 페이지를 새로고침하세요.',
      dismiss: '닫기',
      enableTitle: '알림을 사용하시겠습니까?',
      enableBody: '요청이 업데이트되거나 배정될 때 알림을 받습니다. 나중에 설정에서 변경할 수 있습니다.',
      notNow: '나중에',
      enable: '사용',
      enabling: '활성화 중...'
    }
  }
}

export default translations
