import type { AnomalyId } from '@/lib/detect/catalog'
import { ANOMALIES } from '@/lib/detect/catalog'
import type { Scenario } from '@/lib/scenarios/types'
import type { Locale } from './locales'

/**
 * Translations of the teaching content — the anomaly definitions and the
 * scenario framings.
 *
 * These are the sentences a reader is actually here for, so leaving them in
 * English on the Indonesian pages would make the second locale decorative.
 * The English originals live with the data they describe (the catalogue and the
 * scenario files); this holds the Indonesian, and anything missing falls back to
 * the original rather than showing a blank.
 *
 * Database terminology stays in English throughout, deliberately: `write skew`,
 * `snapshot`, `gap lock`, `dirty read`. A reader who learns them translated
 * cannot then find them in the PostgreSQL documentation or in an error message.
 */

type AnomalyText = {
  readonly name: string
  readonly definition: string
  readonly stakes: string
}

type ScenarioText = {
  readonly title: string
  readonly framing: string
  readonly lesson: string
}

const ANOMALIES_ID: Readonly<Record<AnomalyId, AnomalyText>> = {
  'dirty-write': {
    name: 'Dirty write',
    definition:
      'Dua transaksi menulis baris yang sama sebelum salah satunya berakhir, sehingga rollback tidak bisa memulihkan keadaan yang konsisten — tulisan satu transaksi tersisip di antara tulisan yang lain.',
    stakes:
      'Rollback berhenti menjadi rollback: membatalkan satu transaksi justru memulihkan nilai yang sudah digantikan transaksi lain.',
  },
  'dirty-read': {
    name: 'Dirty read',
    definition:
      'Sebuah transaksi membaca versi baris yang ditulis transaksi lain yang belum commit, jadi nilai yang terbaca bisa jadi tidak pernah ada dalam keadaan mana pun yang sudah commit.',
    stakes: 'Anda bertindak atas angka yang semilidetik kemudian di-rollback.',
  },
  'lost-update': {
    name: 'Lost update',
    definition:
      'Dua transaksi membaca baris yang sama, lalu keduanya menulisnya berdasarkan apa yang mereka baca. Tulisan pertama tertimpa nilai yang dihitung tanpa mengetahuinya.',
    stakes:
      'Pola read-modify-write pada sebuah penghitung: dua pengurangan stok menjadi satu, dan stok jadi salah tanpa satu pun kesalahan muncul.',
  },
  'non-repeatable-read': {
    name: 'Non-repeatable read',
    definition:
      'Sebuah transaksi membaca satu baris dua kali dan memperoleh nilai yang berbeda, karena transaksi lain commit perubahan di antaranya.',
    stakes:
      'Dua bagian dari satu permintaan tidak sepakat tentang baris yang sama, dan cabang mana pun yang berjalan terakhir yang menang.',
  },
  'phantom-read': {
    name: 'Phantom read',
    definition:
      'Sebuah transaksi menjalankan predicate read yang sama dua kali dan hasil kedua memuat baris yang tidak ada di hasil pertama, karena transaksi lain menyisipkan atau menghapus baris yang cocok dengan predikat itu.',
    stakes:
      'Anda memastikan sebuah slot masih kosong, dan ketika pemesanan ditulis, himpunan yang Anda periksa sudah bertambah.',
  },
  'read-skew': {
    name: 'Read skew',
    definition:
      'Sebuah transaksi membaca dua baris dan melihat keduanya dalam keadaan yang tidak pernah berlaku bersamaan, karena transaksi lain commit perubahan atas keduanya di antaranya.',
    stakes:
      'Sebuah transfer bank yang dibaca pada saat yang salah: Anda melihat pendebetannya tetapi belum pengkreditannya, dan pembukuan tidak seimbang.',
  },
  'write-skew': {
    name: 'Write skew',
    definition:
      'Dua transaksi membaca himpunan yang bertumpang tindih, masing-masing memeriksa sebuah constraint atas himpunan itu, lalu masing-masing menulis baris yang berbeda. Tidak ada baris yang ditulis dua kali dan tidak ada yang berkonflik, namun constraint itu berlaku untuk setiap transaksi sendiri-sendiri dan gagal untuk gabungannya.',
    stakes:
      'Jadwal jaga menjadi kosong. Dua dokter masing-masing memastikan ada orang lain yang berjaga, masing-masing keluar dari jadwal, dan keduanya commit — snapshot isolation mengizinkannya, dan tidak ada kesalahan yang muncul.',
  },
}

const SCENARIOS_ID: Readonly<Record<string, ScenarioText>> = {
  'dirty-read': {
    title: 'Membaca nilai yang sudah di-rollback',
    framing:
      'Sebuah pengembalian dana sedang diproses. Transaksi pengembalian itu sudah menurunkan saldo menjadi 0 ketika sebuah query pelaporan membacanya, lalu pengembalian itu gagal dan di-rollback.',
    lesson:
      'ANSI mendefinisikan READ UNCOMMITTED sebagai level yang mengizinkan ini. PostgreSQL menerima namanya lalu memberi Anda READ COMMITTED, jadi query pelaporan melihat 100 di semua level — saldo yang benar-benar commit. MySQL InnoDB adalah kebalikannya: READ UNCOMMITTED-nya sungguhan, dan query itu membaca 0 di sana — saldo yang tidak pernah ada. SQL Server sama sungguhannya. Oracle menolak nama levelnya sama sekali: ia tidak punya READ UNCOMMITTED dan tidak pernah mengizinkan dirty read.',
  },
  'dirty-write': {
    title: 'Dua transaksi menulis baris yang sama sebelum salah satunya berakhir',
    framing:
      'Dua administrator menyunting pengaturan yang sama pada waktu yang sama. Suntingan yang pertama masih belum commit ketika yang kedua menulis.',
    lesson:
      'Tulisan kedua menunggu transaksi pertama berakhir, bukan menimpa nilai yang belum commit — first updater wins. Karena transaksi pertama di-rollback, yang kedua melanjutkan dari baris aslinya.',
  },
  'non-repeatable-read': {
    title: 'Baris yang sama, dibaca dua kali, dengan dua nilai berbeda',
    framing:
      'Sebuah proses checkout membaca ulang harga barang untuk menghitung pajak setelah sebelumnya membacanya untuk menghitung subtotal. Di antara dua pembacaan itu, sebuah perubahan harga commit.',
    lesson:
      'Pada READ COMMITTED setiap statement mengambil snapshot baru, jadi kedua pembacaan itu sah-sah saja berbeda. REPEATABLE READ mengambil satu snapshot untuk seluruh transaksi dan kedua pembacaan mengembalikan 100.',
  },
  'read-skew': {
    title: 'Sebuah transfer yang terlihat setengah jadi',
    framing:
      'Rekening 1 dan 2 masing-masing berisi 100 dan invariannya adalah totalnya 200. Sebuah audit membaca rekening 1, lalu transfer 50 dari rekening 1 ke rekening 2 commit, lalu audit itu membaca rekening 2.',
    lesson:
      'Audit itu membaca 100 lalu 150 dan melaporkan total 250. Tidak ada pembacaan yang melihat data belum commit dan kedua nilai itu sudah commit — hanya saja tidak pada waktu yang sama. Inilah sebabnya sebuah laporan butuh satu snapshot, bukan dua pembacaan yang masing-masing benar.',
  },
  'lost-update': {
    title: 'Dua pengurangan stok menjadi satu',
    framing:
      'Stok sepuluh unit. Dua pesanan masing-masing membaca stok, mengurangi satu, lalu menuliskannya kembali. Yang tercatat sembilan unit, dan satu unit terjual dua kali.',
    lesson:
      'Tidak ada transaksi yang salah bila dilihat sendiri, tidak ada kesalahan yang muncul, dan hitungannya keliru. READ COMMITTED menerapkan ulang tulisan kedua ke versi yang baru commit, jadi ia menulis 9 di atas 9. REPEATABLE READ menolaknya dan membatalkan dengan 40001 — kesalahan yang bisa dicoba ulang oleh kode Anda. MySQL InnoDB mengizinkannya di REPEATABLE READ juga: DML-nya selalu bekerja pada baris terbaru yang commit dan tidak pernah menaikkan serialization error, jadi jadwal yang gagal berisik di PostgreSQL berhasil diam-diam di sana.',
  },
  'lost-update-locked': {
    title: 'Dua pengurangan yang sama, dengan barisnya di-lock',
    framing:
      'Dua pesanan yang sama, tetapi masing-masing membaca stok dengan SELECT ... FOR UPDATE sebelum menuliskannya kembali.',
    lesson:
      'Locking read pesanan kedua menunggu yang pertama commit. Pada READ COMMITTED ia lalu mengembalikan nilai baru, 9, jadi pengurangan kedua dihitung dari apa yang benar-benar ada. Pada REPEATABLE READ, locking read atas baris yang berubah di bawah snapshot justru dibatalkan dengan 40001 — perlindungan yang sama, disampaikan sebagai kesalahan.',
  },
  'phantom-read': {
    title: 'Sebuah pemesanan yang muncul di tengah satu transaksi',
    framing:
      'Slot 1 dan 2 dari kalender lima slot sudah dipesan. Sebuah laporan menghitung jumlah pemesanan, lalu seseorang memesan slot 3 dan commit, lalu laporan itu menghitung lagi untuk menampilkan totalnya.',
    lesson:
      'Pada READ COMMITTED hitungan kedua mengembalikan tiga baris padahal yang pertama dua. REPEATABLE READ pada PostgreSQL mencegah ini — yang tidak diwajibkan standar SQL untuk level itu, dan justru itulah sebabnya nama level tidak bisa dipercaya antar mesin. SQL Server menutup perdebatan itu: REPEATABLE READ-nya memegang shared lock atas baris yang dibaca tetapi tidak bisa me-lock baris yang belum ada, jadi phantom muncul di sana dan tidak di PostgreSQL.',
  },
  'write-skew': {
    title: 'Jadwal jaga yang menjadi kosong',
    framing:
      'Dua dokter sedang berjaga dan setidaknya satu harus tetap berjaga. Masing-masing membuka jadwal, melihat bahwa yang lain berjaga, lalu mengeluarkan dirinya. Keduanya commit.',
    lesson:
      'Inilah write skew: anomali yang tidak ada dalam daftar ANSI. REPEATABLE READ pada PostgreSQL adalah snapshot isolation, dan mengizinkannya: kedua transaksi commit dan tidak ada yang berjaga. Hanya SERIALIZABLE yang menangkapnya, dan caranya dengan membatalkan transaksi kedua yang commit karena read/write dependency — bukan dengan memblokir. MySQL InnoDB juga mengizinkannya di REPEATABLE READ, dan di SERIALIZABLE ia tidak mendeteksi apa pun — ia deadlock. SQL Server mengizinkannya di SNAPSHOT. Dan Oracle mengakhiri perdebatan: ia mengizinkannya di level yang bernama SERIALIZABLE, karena SERIALIZABLE pada Oracle adalah snapshot isolation.',
  },
  'write-skew-locked': {
    title: 'Jadwal jaga yang sama, dibaca dengan FOR UPDATE',
    framing:
      'Dua dokter yang sama, tetapi masing-masing membaca kedua baris dengan SELECT ... FOR UPDATE sebelum menulis, yang biasanya disarankan ketika Anda tidak bisa memakai SERIALIZABLE.',
    lesson:
      'Lock itu men-serialkan kedua transaksi. Locking read dokter kedua menunggu, lalu mengembalikan jadwal yang di dalamnya dokter pertama sudah keluar, sehingga jadwal ini setara dengan menjalankan T1 lalu T2 — tidak ada lagi anomali yang bisa diizinkan basis data. Jadwal jaga tetap kosong, karena jadwal ini menulis tanpa memeriksa ulang apa yang dikembalikan locking read itu; bug yang tersisa itu milik aplikasi, dan sekarang terlihat pada nilai yang terbaca. Pada REPEATABLE READ, locking read itu dibatalkan dengan 40001.',
  },
  'phantom-insert-race': {
    title: 'Dua pemesanan untuk kalender yang kosong ketika keduanya melihat',
    framing:
      'Belum ada yang memesan slot 1 sampai 5. Dua orang masing-masing memastikan rentang itu kosong, lalu masing-masing memesan slot yang berbeda di dalamnya.',
    lesson:
      'Kedua range read tidak mengembalikan apa pun, dan kedua insert berhasil, jadi kalender berakhir dengan dua pemesanan padahal setiap pemesan yakin hanya akan ada satu. Tidak ada baris yang ditulis dua kali, jadi tidak ada yang berkonflik — ini write skew yang berpakaian phantom, dan hanya SERIALIZABLE yang menghentikannya.',
  },
  deadlock: {
    title: 'Dua transfer yang me-lock rekening yang sama dengan urutan berlawanan',
    framing:
      'Dua transfer berjalan bersamaan. Yang satu memindahkan uang dari rekening 1 ke rekening 2 dan me-lock keduanya dengan urutan itu; yang lain memindahkan dari 2 ke 1 dan me-lock dengan urutan sebaliknya. Masing-masing memegang apa yang berikutnya dibutuhkan yang lain.',
    lesson:
      'Tidak ada transaksi yang melakukan hal aneh, dan tidak ada isolation level yang mencegah ini — me-lock dengan urutan yang konsisten adalah tugas aplikasi. Yang berbeda adalah jawaban mesinnya. PostgreSQL dan MySQL InnoDB me-rollback satu transaksi dan menyebutkannya, sehingga yang lain bisa lanjut. SQL Server memilih korbannya berdasarkan perkiraan biaya internal, dan Oracle menyatakan terang-terangan bahwa session mana pun bisa mendapat error itu — jadi untuk ketiganya model ini menolak menyebut siapa yang kalah daripada mengarangnya, dan Oracle pun hanya me-rollback statement-nya, membiarkan transaksinya tetap terbuka.',
  },
}

export function anomalyText(locale: Locale, id: AnomalyId): AnomalyText {
  const original = ANOMALIES[id]
  const translated = locale === 'id' ? ANOMALIES_ID[id] : undefined
  return {
    name: translated?.name ?? original.name,
    definition: translated?.definition ?? original.definition,
    stakes: translated?.stakes ?? original.stakes,
  }
}

export function scenarioText(locale: Locale, scenario: Scenario): ScenarioText {
  const translated = locale === 'id' ? SCENARIOS_ID[scenario.id] : undefined
  return {
    title: translated?.title ?? scenario.title,
    framing: translated?.framing ?? scenario.framing,
    lesson: translated?.lesson ?? scenario.lesson,
  }
}

/** Ids that have Indonesian text, so a test can prove none was forgotten. */
export const TRANSLATED_ANOMALY_IDS = Object.keys(ANOMALIES_ID) as readonly AnomalyId[]
export const TRANSLATED_SCENARIO_IDS = Object.keys(SCENARIOS_ID) as readonly string[]
