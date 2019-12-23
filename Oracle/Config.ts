const config = {
	"title": "Template-Oracle",
	"public_key": "0x1c94f7C71dD60feD6562fb0446365D9B5cdFB980",
	"NODE_URL": "wss://kovan.infura.io/ws/v3/09323fc48925428bbae7cefd272dd0c1",
	"mnemonic" : "silver traffic ready ocean horror shaft foil miss code ribbon liberty glove",
	"contractAddress": "0x8713830ac867e0302e9a3d8e9cd82029cc6784e2",
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