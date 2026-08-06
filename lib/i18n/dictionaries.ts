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
  readonly site: Record<'title' | 'tagline' | 'disclaimer' | 'language', string>
  readonly home: Record<
    | 'lead'
    | 'skewHeading'
    | 'skewBody'
    | 'namesHeading'
    | 'namesBody'
    | 'oracleHeading'
    | 'oracleBody'
    | 'ctaSchedule'
    | 'ctaScenarios',
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
    | 'copied',
    string
  >
  readonly panels: Record<
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
  readonly scenarios: Record<'heading' | 'lead' | 'documents' | 'permittedAt' | 'never' | 'open' | 'framing' | 'lesson', string>
  readonly refusal: Record<'heading' | 'body', string>
  readonly editor: Record<'edit' | 'done' | 'invalid', string>
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
    tagline:
      'Interleave two transactions by hand, watch the anomaly happen, then switch engine and isolation level and watch the same schedule behave completely differently.',
    disclaimer:
      'This models documented behaviour for a fixed set of operations at specific engine versions. It is not a database. Anything outside the modelled set is refused rather than approximated, and every engine claim links to the vendor documentation behind it.',
    language: 'Language',
  },
  home: {
    lead:
      'Every application developer picks an isolation level, usually by accepting the default, and almost none can say what it protects them from.',
    skewHeading: 'Write skew is the point',
    skewBody:
      'Two transactions read the same data, each verify a constraint, each write a different row, and both commit. No shared row, no lock contention, no version clash — and the constraint is violated by the combination. It is absent from the ANSI list, permitted by snapshot isolation, and it is the anomaly most likely to hurt a real application.',
    namesHeading: 'The level names mean different things in different engines',
    namesBody:
      'PostgreSQL’s REPEATABLE READ is snapshot isolation: it prevents phantoms, which ANSI does not require, and permits write skew. PostgreSQL’s READ UNCOMMITTED silently behaves as READ COMMITTED. Oracle’s SERIALIZABLE is snapshot isolation, so it permits write skew despite the name. None of that is derivable from general MVCC knowledge.',
    oracleHeading: 'Checked against real databases',
    oracleBody:
      'Every schedule here has been executed against the real engine in a container, and what it did — values read, waits, error codes, which transaction was aborted, the final table — is committed as a fixture the model is tested against. When the model and the database disagree, the model is wrong.',
    ctaSchedule: 'Open the score',
    ctaScenarios: 'Browse the scenarios',
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
  },
  panels: {
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
  },
  refusal: {
    heading: 'Refused',
    body: 'This engine does not model what was asked for, and guessing at a vendor behaviour would be worse than saying so.',
  },
  editor: {
    edit: 'Edit this schedule',
    done: 'Done editing',
    invalid: 'This schedule cannot be handed to a database as written. Fix the problems above to run it.',
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
    tagline:
      'Susun sendiri urutan dua transaksi, lihat anomalinya terjadi, lalu ganti mesin basis data dan isolation level — dan lihat jadwal yang sama berperilaku sama sekali berbeda.',
    disclaimer:
      'Ini memodelkan perilaku yang terdokumentasi untuk sekumpulan operasi tetap pada versi mesin tertentu. Ini bukan basis data. Apa pun di luar himpunan yang dimodelkan ditolak, bukan didekati, dan setiap klaim tentang mesin tertaut ke dokumentasi vendornya.',
    language: 'Bahasa',
  },
  home: {
    lead:
      'Setiap pengembang aplikasi memilih isolation level, biasanya dengan menerima nilai bawaan, dan hampir tidak ada yang bisa menjelaskan dari apa level itu melindunginya.',
    skewHeading: 'Write skew adalah intinya',
    skewBody:
      'Dua transaksi membaca data yang sama, masing-masing memverifikasi sebuah constraint, masing-masing menulis baris yang berbeda, dan keduanya commit. Tidak ada baris yang sama, tidak ada perebutan lock, tidak ada bentrokan versi — dan constraint itu dilanggar oleh gabungannya. Anomali ini tidak ada dalam daftar ANSI, diizinkan oleh snapshot isolation, dan paling mungkin merugikan aplikasi nyata.',
    namesHeading: 'Nama level berarti berbeda di mesin yang berbeda',
    namesBody:
      'REPEATABLE READ pada PostgreSQL adalah snapshot isolation: ia mencegah phantom — yang tidak diwajibkan ANSI — dan mengizinkan write skew. READ UNCOMMITTED pada PostgreSQL diam-diam berperilaku sebagai READ COMMITTED. SERIALIZABLE pada Oracle adalah snapshot isolation, jadi ia mengizinkan write skew meski namanya begitu. Tidak satu pun dari ini bisa diturunkan dari pengetahuan umum tentang MVCC.',
    oracleHeading: 'Diuji terhadap basis data sungguhan',
    oracleBody:
      'Setiap jadwal di sini telah dijalankan terhadap mesin sungguhan di dalam container, dan apa yang dilakukannya — nilai yang dibaca, penungguan, kode kesalahan, transaksi mana yang dibatalkan, tabel akhirnya — disimpan sebagai fixture yang menguji model ini. Bila model dan basis data berbeda, modelnya yang salah.',
    ctaSchedule: 'Buka partiturnya',
    ctaScenarios: 'Telusuri skenario',
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
  },
  panels: {
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
  },
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, id }

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
