import * as dotenv from "dotenv"
import * as fs from 'fs'

export class EnvironmentHelper {

    static #configured = false
    
    static config() {
        
        if (this.#configured) {
            return
        }

        dotenv.config()
 
        const { name, version, description } = JSON.parse(fs.readFileSync('package.json'))
        EnvironmentHelper['PROJECT_NAME'] = name
        EnvironmentHelper['PROJECT_VERSION'] = version
        EnvironmentHelper['PROJECT_DESCRIPTION'] = description
        
        Object.keys(process.env).forEach(key => EnvironmentHelper[key] = process.env[key])

        this.#configured = true
        
    }

}

EnvironmentHelper.config()