const config = {
	"title": "Template-Oracle",
	"public_key": "0x3fda6E7e9E5AEca8c6B3CD8c32079fB97a4cb221",
	"NODE_URL": "ws://127.0.0.1:7545",
	"mnemonic" : "grass female find slogan motion old merry reject flame direct cycle stomach",
	"contractAddress": "",
	"contractABI": require("../contracts/MultiPartyOracle.json"),
	"STATUS_URL":"",
	"timeout": 180000,
	"EndpointSchema": {
		"name": "qwerty",
		"curve": [2,
			5000000000000000000,
			2000000000000000000,
			1000,
			2,
			0,
			3000000000000000000,
			1000000000000000000
		],
		"broker": "",
		"md": "Adding description for your Oracle here",
		"queryList": [{
			"query": "Query string that your Oracle will accept",
			"params": [],
			"dynamic": false,
			"responseType": "[int]"
		}],
		"responders": [
			"address1",
			"address2",
			"address3"
		]
	}

}
export default config;