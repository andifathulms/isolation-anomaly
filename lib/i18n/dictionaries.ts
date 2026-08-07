import type { Locale } from './locales'

/**
 * UI copy. English is the default locale; Indonesian is secondary.
 *
 * Database terminology stays in English in both — `dirty read`, `write skew`,
 * `snapshot`, `gap lock`, `serializable` — because the reader will meet those
 * words in that form in the vendor documentation and in error messages, and
 * translating them would make the documentation harder to read, not easier.
 */
export type Dictionary = {
  readonly nav: Record<'home' | 'schedule' | 'scenarios' | 'matrix' | 'graph' | 'engines', string>
  readonly site: Record<
    | 'title'
    | 'tagline'
    | 'standfirst'
    | 'disclaimer'
    | 'disclaimerHeading'
    | 'language'
    | 'theme'
    | 'themeToDark'
    | 'themeToLight'
    | 'skipToContent'
    | 'menu',
    string
  >
  readonly home: Record<
    | 'eyebrow'
    | 'lead'
    | 'plainHeading'
    | 'plainBody'
    | 'storyHeading'
    | 'storyIntro'
    | 'storyStep1'
    | 'storyStep2'
    | 'storyStep3'
    | 'storyStep4'
    | 'storyPunchline'
    | 'howHeading'
    | 'how1Heading'
    | 'how1Body'
    | 'how2Heading'
    | 'how2Body'
    | 'how3Heading'
    | 'how3Body'
    | 'skewHeading'
    | 'skewBody'
    | 'namesHeading'
    | 'namesBody'
    | 'oracleHeading'
    | 'oracleBody'
    | 'ctaSchedule'
    | 'ctaScenarios'
    | 'ctaCaption'
    | 'figureAlt'
    | 'figureCaption'
    | 'anomalyListHeading'
    | 'notationHint',
    string
  >
  readonly controls: Record<
    | 'engine'
    | 'level'
    | 'scenario'
    | 'step'
    | 'first'
    | 'previous'
    | 'next'
    | 'last'
    | 'ofSteps'
    | 'alias'
    | 'aliasNote'
    | 'copyLink'
    | 'copied'
    | 'setup'
    | 'playback'
    | 'play'
    | 'pause'
    | 'replay'
    | 'keyboardHint',
    string
  >
  /** The notation key for the score — the single biggest comprehension gap. */
  readonly legend: Record<
    | 'heading'
    | 'show'
    | 'hide'
    | 'intro'
    | 'voices'
    | 'voicesBody'
    | 'read'
    | 'readBody'
    | 'write'
    | 'writeBody'
    | 'commit'
    | 'commitBody'
    | 'rollback'
    | 'rollbackBody'
    | 'wait'
    | 'waitBody'
    | 'playhead'
    | 'playheadBody'
    | 'mark'
    | 'markBody'
    | 'notation'
    | 'notationBody',
    string
  >
  /** The dismissible first-run walkthrough on the schedule page. */
  readonly tour: Record<
    | 'step1Heading'
    | 'step1Body'
    | 'step2Heading'
    | 'step2Body'
    | 'step3Heading'
    | 'step3Body'
    | 'next'
    | 'back'
    | 'skip'
    | 'done'
    | 'progress',
    string
  >
  readonly panels: Record<
    | 'heading'
    | 'headingHint'
    | 'versions'
    | 'versionsHint'
    | 'locks'
    | 'locksHint'
    | 'locksEmpty'
    | 'snapshots'
    | 'snapshotsHint'
    | 'snapshotsEmpty'
    | 'key'
    | 'value'
    | 'createdBy'
    | 'deletedBy'
    | 'atStep'
    | 'live'
    | 'superseded'
    | 'deleted'
    | 'holder'
    | 'mode'
    | 'resource'
    | 'duration'
    | 'waitingFor'
    | 'takenAtStep'
    | 'sees'
    | 'stillRunning'
    | 'noSnapshot'
    | 'committedTable'
    | 'empty',
    string
  >
  readonly outcome: Record<
    'committed' | 'aborted' | 'open' | 'blocked' | 'refused' | 'waited' | 'rowsRead' | 'rowsAffected' | 'noRow',
    string
  >
  readonly anomaly: Record<
    | 'none'
    | 'noneBody'
    | 'noneHeadline'
    | 'foundHeadline'
    | 'permittedHere'
    | 'found'
    | 'definition'
    | 'formal'
    | 'stakes'
    | 'mechanism'
    | 'sources'
    | 'inAnsi'
    | 'notInAnsi'
    | 'conductorMark',
    string
  >
  readonly matrix: Record<
    'heading' | 'lead' | 'clean' | 'anomalyAt' | 'abortedAt' | 'refused' | 'legend' | 'level' | 'engine',
    string
  >
  readonly graph: Record<
    'heading' | 'lead' | 'cycle' | 'noCycle' | 'noCycleBody' | 'edges' | 'ww' | 'wr' | 'rw' | 'viaPredicate' | 'noEdges',
    string
  >
  readonly engines: Record<
    | 'heading'
    | 'lead'
    | 'version'
    | 'verified'
    | 'defaultLevel'
    | 'modelled'
    | 'aliasOf'
    | 'unsupported'
    | 'citations'
    | 'errors'
    | 'reads'
    | 'conflicts'
    | 'locksTaken'
    | 'serializationCheck'
    | 'readDocs',
    string
  >
  readonly scenarios: Record<
    'heading' | 'lead' | 'documents' | 'permittedAt' | 'never' | 'open' | 'framing' | 'lesson' | 'noAnomaly',
    string
  >
  readonly refusal: Record<'heading' | 'body', string>
  readonly editor: Record<'edit' | 'done' | 'invalid' | 'dragHint', string>
}

const en: Dictionary = {
  nav: {
    home: 'Overview',
    schedule: 'Schedule',
    scenarios: 'Scenarios',
    matrix: 'Matrix',
    graph: 'Conflict graph',
    engines: 'Engines',
  },
  site: {
    title: 'Isolation Anomaly',
    tagline: 'Watch two transactions quietly corrupt each other.',
    standfirst:
      'An interactive database simulator. Run two transactions side by side, one step at a time, and see exactly where the database gave a wrong answer — then change the engine or the isolation level and watch the same steps come out differently.',
    disclaimer:
      'This models documented behaviour for a fixed set of operations at specific engine versions. It is not a database. Anything outside the modelled set is refused rather than approximated, and every engine claim links to the vendor documentation behind it.',
    disclaimerHeading: 'What this is, precisely',
    language: 'Language',
    theme: 'Theme',
    themeToDark: 'Switch to the dark manuscript',
    themeToLight: 'Switch to the light manuscript',
    skipToContent: 'Skip to content',
    menu: 'Sections',
  },
  home: {
    eyebrow: 'Interactive · Runs in your browser · No signup',
    lead:
      'Every application developer picks an isolation level, usually by accepting the default, and almost none can say what it protects them from.',
    plainHeading: 'In plain terms',
    plainBody:
      'Your database runs many transactions at the same time. To stay fast, it lets them see slightly stale or half-finished versions of each other’s work. Usually that is invisible. Sometimes two transactions overlap in just the wrong order and the result is an answer that is simply wrong — money counted twice, a rule enforced by nobody, a row that vanishes mid-read. The setting that decides how much overlap is allowed is called the isolation level. This site lets you cause those failures on purpose and watch them happen.',
    storyHeading: 'A failure you can hold in your head',
    storyIntro:
      'A hospital rule says at least one doctor must stay on call. Two are on call right now. Both decide to go home at the same moment.',
    storyStep1: 'Dr A checks how many doctors are on call. The answer is two.',
    storyStep2: 'Dr B checks at the same instant. Also two.',
    storyStep3: 'A sees that one other doctor remains, so A takes themselves off call.',
    storyStep4: 'B sees that one other doctor remains, so B takes themselves off call.',
    storyPunchline:
      'Nobody is on call. Neither transaction touched the other’s row, nothing was locked, no error was raised, and both committed successfully. This is write skew, and most databases permit it at the level you are probably running right now.',
    howHeading: 'How to use this',
    how1Heading: 'Pick a failure',
    how1Body:
      'Each scenario is a real, classic failure written out as two or three transactions with their statements interleaved in a specific order.',
    how2Heading: 'Step through it',
    how2Body:
      'Press Next to advance one statement at a time. The score shows who did what and when; the panels below show the state of the engine at that exact moment.',
    how3Heading: 'Change one thing',
    how3Body:
      'Swap the engine or raise the isolation level and the same steps re-run instantly. What changes — and what stubbornly does not — is the whole lesson.',
    skewHeading: 'Write skew is the point',
    skewBody:
      'Two transactions read the same data, each verify a constraint, each write a different row, and both commit. No shared row, no lock contention, no version clash — and the constraint is violated by the combination. It is absent from the ANSI list, permitted by snapshot isolation, and it is the anomaly most likely to hurt a real application.',
    namesHeading: 'The level names mean different things in different engines',
    namesBody:
      'PostgreSQL’s REPEATABLE READ is snapshot isolation: it prevents phantoms, which ANSI does not require, and permits write skew. PostgreSQL’s READ UNCOMMITTED silently behaves as READ COMMITTED. Oracle’s SERIALIZABLE is snapshot isolation, so it permits write skew despite the name. None of that is derivable from general MVCC knowledge.',
    oracleHeading: 'Checked against real databases',
    oracleBody:
      'Every schedule here has been executed against the real engine in a container, and what it did — values read, waits, error codes, which transaction was aborted, the final table — is committed as a fixture the model is tested against. When the model and the database disagree, the model is wrong.',
    ctaSchedule: 'See it happen: two doctors, both go off call',
    ctaScenarios: 'Browse all 11 failures',
    ctaCaption: 'Opens the schedule below, running on PostgreSQL 16 at REPEATABLE READ.',
    figureAlt:
      'A schedule of two transactions on parallel staves. T1 and T2 each read the on-call roster and see the same two doctors, then each writes a different row taking one doctor off call, and both commit. A red mark sits over step 5, where the anomaly became unavoidable.',
    figureCaption:
      'Two transactions, eight steps, left to right. Both read the roster and see the same two doctors; each then writes a different row. Nothing collides, both commit, and the red mark is where it became unavoidable.',
    anomalyListHeading: 'The failures this site can name',
    notationHint:
      'The formula beside each name is the standard shorthand for a schedule: r is a read, w is a write, c a commit; the number is which transaction did it, and the letter in brackets is which row. So w1[x] r2[x] reads “transaction 1 writes row x, then transaction 2 reads row x”.',
  },
  controls: {
    engine: 'Engine',
    level: 'Isolation level',
    scenario: 'Scenario',
    step: 'Step',
    first: 'First step',
    previous: 'Previous step',
    next: 'Next step',
    last: 'Last step',
    ofSteps: 'of',
    alias: 'alias',
    aliasNote: 'This engine accepts the level name and runs',
    copyLink: 'Copy link to this run',
    copied: 'Link copied',
    setup: 'What to run',
    playback: 'Step through it',
    play: 'Play',
    pause: 'Pause',
    replay: 'Replay from the start',
    keyboardHint: 'The left and right arrow keys step too.',
  },
  legend: {
    heading: 'How to read the score',
    show: 'How do I read this?',
    hide: 'Hide the key',
    intro:
      'Each horizontal line is one transaction — one database session, issuing its statements left to right. Everything in the same vertical column happened at the same point in the run, so reading straight down tells you what the two sessions were doing to each other.',
    voices: 'One line per transaction',
    voicesBody:
      'Each transaction gets its own colour and its own marker shape, so the two never depend on colour alone to be told apart.',
    read: 'Hollow marker — a read',
    readBody: 'The value it saw is printed above the marker. That value is the whole story in most anomalies.',
    write: 'Filled marker — a write',
    writeBody: 'An insert, update or delete. The row it touched is named underneath.',
    commit: 'One bar line — commit',
    commitBody: 'The transaction finished and its work became permanent and visible to everyone.',
    rollback: 'Two bar lines — rollback',
    rollbackBody: 'The transaction was undone, either because it asked to be or because the engine killed it.',
    wait: 'Dashed arc — a wait',
    waitBody:
      'The statement could not proceed and blocked on a lock. The arc lands on the step that finally released it.',
    playhead: 'Solid line with a triangle — where you are',
    playheadBody: 'The step currently shown in the panels below. Stepping moves it.',
    mark: 'Red bracket — the moment it went wrong',
    markBody:
      'It sits above the step where the anomaly became unavoidable. Red is used for nothing else on this site.',
    notation: 'The labels, e.g. w1[x]',
    notationBody:
      'Standard schedule shorthand: r is a read, w a write, c a commit, a an abort. The digit is the transaction and the letter in brackets is the row.',
  },
  tour: {
    step1Heading: 'These lines are transactions running at once',
    step1Body:
      'Two database sessions, one line each, both live at the same time. Anything sharing a vertical column happened at the same moment — that overlap is what causes everything else here.',
    step2Heading: 'Step through it one statement at a time',
    step2Body:
      'Next advances a single statement and freezes the engine right there, so the panels underneath show exactly what was true at that instant. Nothing is being re-run; you are scrubbing a recording.',
    step3Heading: 'Then change the engine or the level',
    step3Body:
      'The same statements in the same order, re-executed against a different database or a stricter isolation level. When the outcome changes, you have found what that setting actually buys you.',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    done: 'Got it',
    progress: 'of',
  },
  panels: {
    heading: 'Inside the engine at this step',
    headingHint:
      'The state of the database at the exact statement above — not the end of the run. Step backwards and forwards to watch these change.',
    versions: 'Version chains',
    versionsHint:
      'Every write creates a version rather than replacing one. xmin is the transaction that created it, xmax the transaction that superseded or deleted it.',
    locks: 'Locks held',
    locksHint:
      'A record lock is on a row. A gap lock is on the space between rows, and it exists to stop an insert appearing where a reader has already looked.',
    locksEmpty: 'No locks held at this step.',
    snapshots: 'Snapshots',
    snapshotsHint: 'Which transactions had committed when each snapshot was taken.',
    snapshotsEmpty: 'No snapshot taken yet.',
    key: 'Key',
    value: 'Value',
    createdBy: 'xmin',
    deletedBy: 'xmax',
    atStep: 'step',
    live: 'live',
    superseded: 'superseded',
    deleted: 'deleted',
    holder: 'Holder',
    mode: 'Mode',
    resource: 'Resource',
    duration: 'Held until',
    waitingFor: 'waiting for',
    takenAtStep: 'taken at step',
    sees: 'sees',
    stillRunning: 'still running',
    noSnapshot: 'no snapshot',
    committedTable: 'Committed table',
    empty: 'empty',
  },
  outcome: {
    committed: 'committed',
    aborted: 'aborted',
    open: 'left open',
    blocked: 'still waiting',
    refused: 'refused',
    waited: 'waited, completed at step',
    rowsRead: 'read',
    rowsAffected: 'rows',
    noRow: 'no row',
  },
  anomaly: {
    none: 'No anomaly',
    noneBody: 'Nothing in the published definitions occurred in this run.',
    noneHeadline: 'This run came out clean',
    foundHeadline: 'The database gave a wrong answer',
    permittedHere: 'permitted at this engine and level',
    found: 'Anomaly',
    definition: 'Definition',
    formal: 'Phenomenon',
    stakes: 'Why it matters',
    mechanism: 'What happened here',
    sources: 'Sources',
    inAnsi: 'in the ANSI SQL-92 list',
    notInAnsi: 'not in the ANSI SQL-92 list',
    conductorMark: 'The mark sits on the step where this became inevitable.',
  },
  matrix: {
    heading: 'The same schedule, every engine, every level',
    lead:
      'Committed, aborted with which error, or completed with an anomaly. The disagreement between engines is the lesson.',
    clean: 'clean',
    anomalyAt: 'anomaly',
    abortedAt: 'aborted',
    refused: 'no such level',
    legend: 'Legend',
    level: 'Level',
    engine: 'Engine',
  },
  graph: {
    heading: 'Conflict graph',
    lead:
      'Nodes are the committed transactions, edges are conflicting operation pairs in the order they happened. An edge from A to B says that in any equivalent serial schedule, A must run before B.',
    cycle: 'Not conflict-serializable',
    noCycle: 'Conflict-serializable',
    noCycleBody: 'A serial order of these transactions produces the same result:',
    edges: 'Conflicts',
    ww: 'write then write',
    wr: 'write then read',
    rw: 'read then write',
    viaPredicate: 'via a predicate read',
    noEdges: 'No conflicting operation pairs in this run.',
  },
  engines: {
    heading: 'Engine packs',
    lead:
      'Engine behaviour here is data, not code: each pack states, per level, what a read sees, what a write does when it loses a race, which locks each operation takes and for how long, and whether a serialization check runs. Every rule carries a verbatim quote from the vendor’s own documentation, and the build fails without one.',
    version: 'Version modelled',
    verified: 'Documentation read on',
    defaultLevel: 'Default level',
    modelled: 'modelled',
    aliasOf: 'alias for',
    unsupported: 'not a level this engine has',
    citations: 'Citations',
    errors: 'Errors',
    reads: 'What a read sees',
    conflicts: 'Conflicts',
    locksTaken: 'Locks taken',
    serializationCheck: 'Serialization check',
    readDocs: 'Read the documentation',
  },
  scenarios: {
    heading: 'Scenarios',
    lead:
      'Each classic anomaly as a runnable schedule, with the framing that makes the stakes obvious and the levels that permit it.',
    documents: 'Documents',
    permittedAt: 'Permitted at',
    never: 'not permitted at any level of this engine',
    open: 'Open in the score',
    framing: 'The situation',
    lesson: 'What it teaches',
    noAnomaly: 'Documents an engine’s response rather than an anomaly',
  },
  refusal: {
    heading: 'Refused',
    body: 'This engine does not model what was asked for, and guessing at a vendor behaviour would be worse than saying so.',
  },
  editor: {
    edit: 'Edit this schedule',
    done: 'Done editing',
    invalid: 'This schedule cannot be handed to a database as written. Fix the problems above to run it.',
    dragHint:
      'Drag a mark sideways to re-interleave and re-run. A mark can only move between its own transaction’s neighbouring operations — a session issues its statements in order, so the interleaving is the only thing you get to choose.',
  },
}

const id: Dictionary = {
  nav: {
    home: 'Ikhtisar',
    schedule: 'Jadwal',
    scenarios: 'Skenario',
    matrix: 'Matriks',
    graph: 'Graf konflik',
    engines: 'Mesin',
  },
  site: {
    title: 'Isolation Anomaly',
    tagline: 'Lihat dua transaksi diam-diam saling merusak.',
    standfirst:
      'Simulator basis data yang interaktif. Jalankan dua transaksi berdampingan, selangkah demi selangkah, dan lihat persis di mana basis data memberi jawaban yang salah — lalu ganti mesin atau isolation level-nya dan lihat langkah yang sama berakhir berbeda.',
    disclaimer:
      'Ini memodelkan perilaku yang terdokumentasi untuk sekumpulan operasi tetap pada versi mesin tertentu. Ini bukan basis data. Apa pun di luar himpunan yang dimodelkan ditolak, bukan didekati, dan setiap klaim tentang mesin tertaut ke dokumentasi vendornya.',
    disclaimerHeading: 'Apa ini, tepatnya',
    language: 'Bahasa',
    theme: 'Tampilan',
    themeToDark: 'Ganti ke manuskrip gelap',
    themeToLight: 'Ganti ke manuskrip terang',
    skipToContent: 'Lompat ke konten',
    menu: 'Bagian',
  },
  home: {
    eyebrow: 'Interaktif · Berjalan di peramban · Tanpa daftar akun',
    lead:
      'Setiap pengembang aplikasi memilih isolation level, biasanya dengan menerima nilai bawaan, dan hampir tidak ada yang bisa menjelaskan dari apa level itu melindunginya.',
    plainHeading: 'Dengan bahasa sederhana',
    plainBody:
      'Basis data Anda menjalankan banyak transaksi sekaligus. Agar tetap cepat, ia membiarkan tiap transaksi melihat versi pekerjaan transaksi lain yang sedikit basi atau setengah jadi. Biasanya itu tidak terasa. Kadang dua transaksi bertumpang tindih pada urutan yang pas salahnya, dan hasilnya jawaban yang memang keliru — uang terhitung dua kali, aturan yang ternyata tidak dijaga siapa pun, baris yang lenyap di tengah pembacaan. Setelan yang menentukan seberapa banyak tumpang tindih yang diizinkan itulah isolation level. Situs ini membuat Anda bisa sengaja memicu kegagalan itu dan menyaksikannya terjadi.',
    storyHeading: 'Satu kegagalan yang mudah dibayangkan',
    storyIntro:
      'Aturan rumah sakit: minimal satu dokter harus tetap berjaga. Saat ini ada dua yang berjaga. Keduanya memutuskan pulang pada saat yang sama.',
    storyStep1: 'Dokter A memeriksa berapa dokter yang sedang berjaga. Jawabannya dua.',
    storyStep2: 'Dokter B memeriksa pada detik yang sama. Dua juga.',
    storyStep3: 'A melihat masih ada satu dokter lain, jadi A berhenti berjaga.',
    storyStep4: 'B melihat masih ada satu dokter lain, jadi B berhenti berjaga.',
    storyPunchline:
      'Tidak ada yang berjaga. Tak satu pun transaksi menyentuh baris milik yang lain, tidak ada yang terkunci, tidak ada kesalahan yang muncul, dan keduanya berhasil commit. Inilah write skew, dan sebagian besar basis data mengizinkannya pada level yang kemungkinan besar Anda pakai sekarang.',
    howHeading: 'Cara memakainya',
    how1Heading: 'Pilih satu kegagalan',
    how1Body:
      'Tiap skenario adalah kegagalan klasik yang nyata, ditulis sebagai dua atau tiga transaksi dengan statement-nya disisipkan dalam urutan tertentu.',
    how2Heading: 'Telusuri langkah demi langkah',
    how2Body:
      'Tekan Berikutnya untuk maju satu statement. Partitur menunjukkan siapa melakukan apa dan kapan; panel di bawahnya menunjukkan keadaan mesin pada saat itu juga.',
    how3Heading: 'Ubah satu hal',
    how3Body:
      'Ganti mesinnya atau naikkan isolation level-nya, dan langkah yang sama langsung dijalankan ulang. Apa yang berubah — dan apa yang keras kepala tidak berubah — itulah seluruh pelajarannya.',
    skewHeading: 'Write skew adalah intinya',
    skewBody:
      'Dua transaksi membaca data yang sama, masing-masing memverifikasi sebuah constraint, masing-masing menulis baris yang berbeda, dan keduanya commit. Tidak ada baris yang sama, tidak ada perebutan lock, tidak ada bentrokan versi — dan constraint itu dilanggar oleh gabungannya. Anomali ini tidak ada dalam daftar ANSI, diizinkan oleh snapshot isolation, dan paling mungkin merugikan aplikasi nyata.',
    namesHeading: 'Nama level berarti berbeda di mesin yang berbeda',
    namesBody:
      'REPEATABLE READ pada PostgreSQL adalah snapshot isolation: ia mencegah phantom — yang tidak diwajibkan ANSI — dan mengizinkan write skew. READ UNCOMMITTED pada PostgreSQL diam-diam berperilaku sebagai READ COMMITTED. SERIALIZABLE pada Oracle adalah snapshot isolation, jadi ia mengizinkan write skew meski namanya begitu. Tidak satu pun dari ini bisa diturunkan dari pengetahuan umum tentang MVCC.',
    oracleHeading: 'Diuji terhadap basis data sungguhan',
    oracleBody:
      'Setiap jadwal di sini telah dijalankan terhadap mesin sungguhan di dalam container, dan apa yang dilakukannya — nilai yang dibaca, penungguan, kode kesalahan, transaksi mana yang dibatalkan, tabel akhirnya — disimpan sebagai fixture yang menguji model ini. Bila model dan basis data berbeda, modelnya yang salah.',
    ctaSchedule: 'Lihat langsung: dua dokter, dua-duanya berhenti berjaga',
    ctaScenarios: 'Telusuri 11 kegagalannya',
    ctaCaption: 'Membuka schedule di bawah, berjalan pada PostgreSQL 16 di REPEATABLE READ.',
    figureAlt:
      'Sebuah schedule berisi dua transaksi pada dua garis paranada sejajar. T1 dan T2 masing-masing membaca daftar jaga dan melihat dua dokter yang sama, lalu masing-masing menulis baris yang berbeda untuk menghentikan satu dokter dari jaga, dan keduanya commit. Tanda merah berada di langkah 5, tempat anomali menjadi tak terhindarkan.',
    figureCaption:
      'Dua transaksi, delapan langkah, dari kiri ke kanan. Keduanya membaca daftar jaga dan melihat dua dokter yang sama; masing-masing lalu menulis baris yang berbeda. Tidak ada yang bertabrakan, keduanya commit, dan tanda merah menandai titik saat hal itu tak lagi terhindarkan.',
    anomalyListHeading: 'Kegagalan yang bisa disebut namanya di sini',
    notationHint:
      'Rumus di samping tiap nama adalah notasi baku untuk sebuah jadwal: r berarti baca, w berarti tulis, c berarti commit; angkanya menunjukkan transaksi mana yang melakukannya, dan huruf dalam kurung siku menunjukkan barisnya. Jadi w1[x] r2[x] dibaca “transaksi 1 menulis baris x, lalu transaksi 2 membaca baris x”.',
  },
  controls: {
    engine: 'Mesin',
    level: 'Isolation level',
    scenario: 'Skenario',
    step: 'Langkah',
    first: 'Langkah pertama',
    previous: 'Langkah sebelumnya',
    next: 'Langkah berikutnya',
    last: 'Langkah terakhir',
    ofSteps: 'dari',
    alias: 'alias',
    aliasNote: 'Mesin ini menerima nama level itu lalu menjalankan',
    copyLink: 'Salin tautan ke tampilan ini',
    copied: 'Tautan disalin',
    setup: 'Yang dijalankan',
    playback: 'Telusuri langkahnya',
    play: 'Jalankan',
    pause: 'Jeda',
    replay: 'Ulangi dari awal',
    keyboardHint: 'Tombol panah kiri dan kanan juga bisa dipakai.',
  },
  legend: {
    heading: 'Cara membaca partitur',
    show: 'Bagaimana cara membacanya?',
    hide: 'Sembunyikan keterangan',
    intro:
      'Tiap garis mendatar adalah satu transaksi — satu session basis data yang mengirim statement-nya dari kiri ke kanan. Segala sesuatu pada kolom tegak yang sama terjadi pada titik yang sama dalam eksekusi, jadi membaca lurus ke bawah memberi tahu Anda apa yang sedang kedua session lakukan terhadap satu sama lain.',
    voices: 'Satu garis per transaksi',
    voicesBody:
      'Tiap transaksi punya warna dan bentuk penanda sendiri, jadi keduanya tidak pernah hanya dibedakan lewat warna.',
    read: 'Penanda kosong — sebuah pembacaan',
    readBody:
      'Nilai yang dilihatnya dicetak di atas penanda. Nilai itulah inti cerita pada hampir semua anomali.',
    write: 'Penanda terisi — sebuah penulisan',
    writeBody: 'Insert, update, atau delete. Baris yang disentuhnya disebut di bawahnya.',
    commit: 'Satu garis tegak — commit',
    commitBody: 'Transaksi selesai dan pekerjaannya menjadi permanen serta terlihat oleh semua orang.',
    rollback: 'Dua garis tegak — rollback',
    rollbackBody: 'Transaksi dibatalkan, entah atas permintaannya sendiri atau karena dimatikan oleh mesin.',
    wait: 'Busur putus-putus — sebuah penungguan',
    waitBody:
      'Statement tidak bisa lanjut dan terhalang oleh lock. Ujung busurnya jatuh pada langkah yang akhirnya melepaskannya.',
    playhead: 'Garis tegas dengan segitiga — posisi Anda',
    playheadBody: 'Langkah yang sedang ditampilkan pada panel di bawah. Menelusuri langkah menggeserkannya.',
    mark: 'Kurung merah — saat semuanya menjadi salah',
    markBody:
      'Letaknya di atas langkah ketika anomali menjadi tak terhindarkan. Merah tidak dipakai untuk hal lain di situs ini.',
    notation: 'Labelnya, misalnya w1[x]',
    notationBody:
      'Notasi baku untuk jadwal: r berarti baca, w tulis, c commit, a abort. Angkanya adalah transaksinya, huruf dalam kurung siku adalah barisnya.',
  },
  tour: {
    step1Heading: 'Garis-garis ini adalah transaksi yang berjalan bersamaan',
    step1Body:
      'Dua session basis data, masing-masing satu garis, keduanya hidup pada saat yang sama. Apa pun yang berbagi kolom tegak terjadi pada saat yang sama — tumpang tindih itulah penyebab segala hal lain di sini.',
    step2Heading: 'Telusuri satu statement setiap kali',
    step2Body:
      'Berikutnya memajukan satu statement dan membekukan mesin tepat di situ, sehingga panel di bawah menunjukkan persis apa yang berlaku pada saat itu. Tidak ada yang dijalankan ulang; Anda sedang menggeser rekaman.',
    step3Heading: 'Lalu ganti mesin atau levelnya',
    step3Body:
      'Statement yang sama dalam urutan yang sama, dieksekusi ulang terhadap basis data lain atau isolation level yang lebih ketat. Ketika hasilnya berubah, Anda menemukan apa yang sebenarnya Anda dapat dari setelan itu.',
    next: 'Berikutnya',
    back: 'Kembali',
    skip: 'Lewati',
    done: 'Paham',
    progress: 'dari',
  },
  panels: {
    heading: 'Isi mesin pada langkah ini',
    headingHint:
      'Keadaan basis data pada statement di atas — bukan pada akhir eksekusi. Majukan dan mundurkan langkahnya untuk melihat semua ini berubah.',
    versions: 'Rantai versi',
    versionsHint:
      'Setiap penulisan membuat versi baru, bukan menggantikan yang lama. xmin adalah transaksi yang membuatnya, xmax transaksi yang menggantikan atau menghapusnya.',
    locks: 'Lock yang dipegang',
    locksHint:
      'Record lock mengunci sebuah baris. Gap lock mengunci ruang antar baris, dan gunanya mencegah sebuah insert muncul di tempat yang sudah dilihat pembaca.',
    locksEmpty: 'Tidak ada lock yang dipegang pada langkah ini.',
    snapshots: 'Snapshot',
    snapshotsHint: 'Transaksi mana saja yang sudah commit ketika tiap snapshot diambil.',
    snapshotsEmpty: 'Belum ada snapshot yang diambil.',
    key: 'Key',
    value: 'Nilai',
    createdBy: 'xmin',
    deletedBy: 'xmax',
    atStep: 'langkah',
    live: 'hidup',
    superseded: 'digantikan',
    deleted: 'dihapus',
    holder: 'Pemegang',
    mode: 'Mode',
    resource: 'Sumber daya',
    duration: 'Dipegang sampai',
    waitingFor: 'menunggu',
    takenAtStep: 'diambil pada langkah',
    sees: 'melihat',
    stillRunning: 'masih berjalan',
    noSnapshot: 'tanpa snapshot',
    committedTable: 'Tabel yang sudah commit',
    empty: 'kosong',
  },
  outcome: {
    committed: 'commit',
    aborted: 'dibatalkan',
    open: 'dibiarkan terbuka',
    blocked: 'masih menunggu',
    refused: 'ditolak',
    waited: 'menunggu, selesai pada langkah',
    rowsRead: 'membaca',
    rowsAffected: 'baris',
    noRow: 'tidak ada baris',
  },
  anomaly: {
    none: 'Tidak ada anomali',
    noneBody: 'Tidak ada satu pun definisi terbitan yang terjadi pada eksekusi ini.',
    noneHeadline: 'Eksekusi ini bersih',
    foundHeadline: 'Basis data memberi jawaban yang salah',
    permittedHere: 'diizinkan pada mesin dan level ini',
    found: 'Anomali',
    definition: 'Definisi',
    formal: 'Fenomena',
    stakes: 'Mengapa ini penting',
    mechanism: 'Apa yang terjadi di sini',
    sources: 'Sumber',
    inAnsi: 'ada dalam daftar ANSI SQL-92',
    notInAnsi: 'tidak ada dalam daftar ANSI SQL-92',
    conductorMark: 'Tanda ini berada pada langkah ketika hal itu menjadi tak terhindarkan.',
  },
  matrix: {
    heading: 'Jadwal yang sama, semua mesin, semua level',
    lead:
      'Commit, dibatalkan dengan kesalahan apa, atau selesai dengan anomali. Perbedaan antar mesin itulah pelajarannya.',
    clean: 'bersih',
    anomalyAt: 'anomali',
    abortedAt: 'dibatalkan',
    refused: 'level tidak ada',
    legend: 'Keterangan',
    level: 'Level',
    engine: 'Mesin',
  },
  graph: {
    heading: 'Graf konflik',
    lead:
      'Simpul adalah transaksi yang commit, sisi adalah pasangan operasi yang berkonflik dalam urutan terjadinya. Sisi dari A ke B berarti: dalam setiap jadwal serial yang ekuivalen, A harus berjalan sebelum B.',
    cycle: 'Tidak conflict-serializable',
    noCycle: 'Conflict-serializable',
    noCycleBody: 'Urutan serial transaksi berikut menghasilkan hasil yang sama:',
    edges: 'Konflik',
    ww: 'tulis lalu tulis',
    wr: 'tulis lalu baca',
    rw: 'baca lalu tulis',
    viaPredicate: 'melalui predicate read',
    noEdges: 'Tidak ada pasangan operasi yang berkonflik pada eksekusi ini.',
  },
  engines: {
    heading: 'Paket mesin',
    lead:
      'Perilaku mesin di sini adalah data, bukan kode: setiap paket menyatakan, per level, apa yang dilihat sebuah pembacaan, apa yang dilakukan sebuah penulisan ketika kalah bersaing, lock apa yang diambil setiap operasi dan sampai kapan, serta apakah ada serialization check. Setiap aturan membawa kutipan verbatim dari dokumentasi vendornya, dan build gagal tanpa itu.',
    version: 'Versi yang dimodelkan',
    verified: 'Dokumentasi dibaca pada',
    defaultLevel: 'Level bawaan',
    modelled: 'dimodelkan',
    aliasOf: 'alias untuk',
    unsupported: 'bukan level yang dimiliki mesin ini',
    citations: 'Kutipan',
    errors: 'Kesalahan',
    reads: 'Apa yang dilihat pembacaan',
    conflicts: 'Konflik',
    locksTaken: 'Lock yang diambil',
    serializationCheck: 'Serialization check',
    readDocs: 'Baca dokumentasinya',
  },
  scenarios: {
    heading: 'Skenario',
    lead:
      'Setiap anomali klasik sebagai jadwal yang bisa dijalankan, dengan penggambaran yang membuat risikonya jelas dan daftar level yang mengizinkannya.',
    documents: 'Mendokumentasikan',
    permittedAt: 'Diizinkan pada',
    never: 'tidak diizinkan pada level mana pun di mesin ini',
    open: 'Buka di partitur',
    framing: 'Situasinya',
    lesson: 'Pelajarannya',
    noAnomaly: 'Mendokumentasikan respons mesin, bukan sebuah anomali',
  },
  refusal: {
    heading: 'Ditolak',
    body:
      'Mesin ini tidak memodelkan apa yang diminta, dan menebak perilaku vendor akan lebih buruk daripada mengatakannya terus terang.',
  },
  editor: {
    edit: 'Sunting jadwal ini',
    done: 'Selesai menyunting',
    invalid:
      'Jadwal ini tidak bisa diberikan ke basis data seperti apa adanya. Perbaiki masalah di atas untuk menjalankannya.',
    dragHint:
      'Geser sebuah tanda ke samping untuk mengubah urutan sisipan lalu menjalankannya ulang. Sebuah tanda hanya bisa bergerak di antara operasi tetangganya dalam transaksi yang sama — sebuah session mengirim statement-nya secara berurutan, jadi yang bisa Anda pilih hanyalah cara menyisipkannya.',
  },
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, id }

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
