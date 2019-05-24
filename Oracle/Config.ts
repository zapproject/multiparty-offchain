const config = {
	"title": "Template-Oracle",
	"public_key": "0x6397c23f4e8914197699ba54Fc01333053C967cE",
	"NODE_URL": "ws://127.0.0.1:7545",
	"mnemonic" : "grass female find slogan motion old merry reject flame direct cycle stomach",
	"contractAddress": "0x0fDA6B12Cc079493f8A519eDa1A7c2209F429fF6",
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