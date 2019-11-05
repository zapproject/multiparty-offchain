const config = {
	"title": "Template-Oracle",
	"public_key": "0x6397c23f4e8914197699ba54Fc01333053C967cE",
	"NODE_URL": "ws://127.0.0.1:7545",
	"mnemonic" : "grass female find slogan motion old merry reject flame direct cycle stomach",
	"contractAddress": "0xb9Ac0A98fF41C2971061F2133a164611EAc950EB",
	"contractABI": require("../contracts/MultiPartyOracle.json"),
	"STATUS_URL":"",
	"timeout": 18000000000,
	"EndpointSchema": {
		"name": "qwerty",
		"responders": [
			"",
			"",
			""
		]
	}

}
export default config;