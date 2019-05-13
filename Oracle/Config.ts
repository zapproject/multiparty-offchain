const config = {
	"title": "Title",
	"public_key": "Public key",
	"NODE_URL": "wss://mainnet.infura.io/ws/v3/63dbbe242127449b9aeb061c6640ab95",
	"mnemonic": "",
	"contractAddress": "",
	"contractABI": "",
	"STATUS_URL":"",
	"timeout": 180000,
	"EndpointSchema": {
		"name": "",
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