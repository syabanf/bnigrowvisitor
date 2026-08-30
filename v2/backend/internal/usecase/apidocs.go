package usecase

import "bni-visitor/internal/domain"

// APIDocs describes the external API for the people holding a key.
//
// Served from the server rather than written as a separate page, so the scopes
// and the base URL come from the same values the middleware enforces. A hand-
// written copy is exactly how the key screen came to offer a scope that was
// refused everywhere.
type APIDocs struct {
	BaseURL   string        `json:"base_url"`
	Auth      APIAuthDoc    `json:"auth"`
	Scopes    []APIScopeDoc `json:"scopes"`
	RateLimit string        `json:"rate_limit"`
	Endpoints []APIEndpoint `json:"endpoints"`
	Errors    []APIErrorDoc `json:"errors"`
}

type APIAuthDoc struct {
	Headers     []string `json:"headers"`
	Description string   `json:"description"`
}

type APIScopeDoc struct {
	Value       string `json:"value"`
	Description string `json:"description"`
}

type APIEndpoint struct {
	Method      string           `json:"method"`
	Path        string           `json:"path"`
	Scope       string           `json:"scope"`
	Summary     string           `json:"summary"`
	Params      []APIParam       `json:"params,omitempty"`
	RequestBody string           `json:"request_body,omitempty"`
	Response    string           `json:"response"`
	Notes       []string         `json:"notes,omitempty"`
	Example     APIExampleReqRes `json:"example"`
}

type APIParam struct {
	Name        string `json:"name"`
	In          string `json:"in"`
	Description string `json:"description"`
}

type APIExampleReqRes struct {
	Request  string `json:"request"`
	Response string `json:"response"`
}

type APIErrorDoc struct {
	Status  int    `json:"status"`
	Meaning string `json:"meaning"`
}

func BuildAPIDocs(baseURL string) APIDocs {
	scopes := make([]APIScopeDoc, 0)
	for _, s := range domain.AllAPIScopes() {
		scopes = append(scopes, APIScopeDoc{Value: string(s), Description: s.Description()})
	}

	return APIDocs{
		BaseURL: baseURL + "/external/v1",
		Auth: APIAuthDoc{
			Headers: []string{"Authorization: Bearer <kunci>", "X-API-Key: <kunci>"},
			Description: "Pakai salah satu, bukan keduanya. Kunci hanya ditampilkan sekali " +
				"saat dibuat — server menyimpan hash-nya, jadi kunci yang hilang harus " +
				"diterbitkan ulang, bukan dipulihkan.",
		},
		Scopes:    scopes,
		RateLimit: "120 permintaan per menit per alamat IP. Melebihi itu menghasilkan 429.",
		Endpoints: []APIEndpoint{
			{
				Method: "GET", Path: "/members", Scope: string(domain.ScopeReadOnly),
				Summary: "Daftar member, dengan paginasi.",
				Params: []APIParam{
					{Name: "q", In: "query", Description: "Cari pada nama, telepon, email, perusahaan."},
					{Name: "status", In: "query", Description: "active, inactive, atau suspended."},
					{Name: "limit", In: "query", Description: "Baris per halaman, maksimal 200 (default 50)."},
					{Name: "offset", In: "query", Description: "Baris yang dilewati (default 0)."},
				},
				Response: `{ "data": [...], "total": 48, "limit": 50, "offset": 0 }`,
				Notes: []string{
					"Responsnya sengaja lebih sempit daripada API internal: tidak ada " +
						"nomor telepon, email, catatan, atau siapa yang mengajak. Integrasi " +
						"butuh status keanggotaan, bukan data pribadi.",
					"is_overdue diturunkan dari renewal_date saat dibaca, tidak disimpan, " +
						"jadi tidak bisa berbeda dari tanggalnya.",
				},
				Example: APIExampleReqRes{
					Request: `curl -H "X-API-Key: $KUNCI" \
  "https://contoh.id/external/v1/members?status=active&limit=2"`,
					Response: `{
  "data": [
    {
      "id": "5f2c…",
      "name": "Putri Rahayu",
      "chapter_id": "a000…",
      "chapter_name": "BNI Grow",
      "status": "active",
      "joined_date": "2024-02-11T00:00:00Z",
      "renewal_date": "2027-03-20T00:00:00Z",
      "is_overdue": false
    }
  ],
  "total": 48,
  "limit": 2,
  "offset": 0
}`,
				},
			},
			{
				Method: "GET", Path: "/members/{id}", Scope: string(domain.ScopeReadOnly),
				Summary:  "Satu member berdasarkan id.",
				Params:   []APIParam{{Name: "id", In: "path", Description: "UUID member."}},
				Response: `{ "data": { … } }`,
				Notes: []string{
					"id yang bukan UUID menghasilkan 404, bukan 500 — sebuah segmen yang " +
						"bukan UUID tidak bisa menamai baris mana pun.",
				},
				Example: APIExampleReqRes{
					Request:  `curl -H "X-API-Key: $KUNCI" "https://contoh.id/external/v1/members/5f2c…"`,
					Response: `{ "data": { "id": "5f2c…", "name": "Putri Rahayu", "chapter_name": "BNI Grow", "status": "active", "renewal_date": "2027-03-20T00:00:00Z", "is_overdue": false } }`,
				},
			},
			{
				Method: "POST", Path: "/members/{id}/renewal", Scope: string(domain.ScopeFinance),
				Summary: "Catat perpanjangan keanggotaan.",
				Params:  []APIParam{{Name: "id", In: "path", Description: "UUID member."}},
				// Body opsional. Kolomnya renewal_date, bukan jumlah bulan —
				// dokumentasi ini sempat menulis {"months": 12}, yang ditolak
				// 400 karena field tak dikenal. Contoh di bawah dijalankan
				// betulan sebelum ditulis.
				RequestBody: `{ "renewal_date": "2027-12-31" }   // opsional`,
				Response:    `{ "data": { …, "renewal_date": "2027-12-31", "is_overdue": false } }`,
				Notes: []string{
					"Body boleh dikosongkan. Tanpa renewal_date, masa berlaku diperpanjang " +
						"satu tahun dari mana yang lebih akhir — tanggal berlaku sekarang " +
						"atau hari ini. Memperpanjang lebih awal tidak memotong masa " +
						"keanggotaan, dan memperpanjang terlambat tidak memundurkannya.",
					"Field yang tidak dikenal ditolak dengan 400, bukan diabaikan diam-diam: " +
						"salah ketik nama field akan tampak seperti berhasil padahal tidak " +
						"mengubah apa pun.",
					"Statusnya ikut jadi active, dan last_renewed_at dicatat.",
					"Satu-satunya operasi tulis di API ini, dan satu-satunya yang butuh " +
						"scope finance.",
				},
				Example: APIExampleReqRes{
					Request: `# tanpa body: perpanjang satu tahun
curl -X POST -H "X-API-Key: $KUNCI" \
  "https://contoh.id/external/v1/members/5f2c…/renewal"

# atau dengan tanggal eksplisit
curl -X POST -H "X-API-Key: $KUNCI" -H "Content-Type: application/json" \
  -d '{"renewal_date":"2027-12-31"}' \
  "https://contoh.id/external/v1/members/5f2c…/renewal"`,
					Response: `{ "data": { "id": "5f2c…", "renewal_date": "2027-12-31", "status": "active", "is_overdue": false } }`,
				},
			},
		},
		Errors: []APIErrorDoc{
			{Status: 401, Meaning: "Kunci tidak disertakan, tidak dikenal, dinonaktifkan, atau kedaluwarsa. " +
				"Keempatnya memberi pesan yang sama — membedakannya akan memberi tahu penyerang mana tebakan yang mendekati."},
			{Status: 403, Meaning: "Kunci sah tapi scope-nya kurang. Pesannya menyebut scope yang dibutuhkan."},
			{Status: 404, Meaning: "Member tidak ada, atau id-nya bukan UUID."},
			{Status: 422, Meaning: "Body tidak valid, misalnya months di luar rentang yang wajar."},
			{Status: 429, Meaning: "Melewati batas laju. Coba lagi setelah jendela satu menit berlalu."},
		},
	}
}
