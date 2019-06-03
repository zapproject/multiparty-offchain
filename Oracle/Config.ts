const config = {
	"title": "Template-Oracle",
	"public_key": "0x6397c23f4e8914197699ba54Fc01333053C967cE",
	"NODE_URL": "wss://kovan.infura.io/ws/v3/09323fc48925428bbae7cefd272dd0c1",
	"mnemonic" : "silver traffic ready ocean horror shaft foil miss code ribbon liberty glove",
	"contractAddress": "0x0d3c8fe0c248ec9abb66603f6fae48d176193e2c",
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