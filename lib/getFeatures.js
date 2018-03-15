import { getFeatures } from 'cucumber/lib/cli/helpers'
import { _ } from 'lodash'
import path from 'path'

export async function fixedGetFeatures(options) {
    let initialFeatures = await getFeatures(options),
        templates = findTemplates(initialFeatures),
        templatedScenarios,
        pointScenario,
        insertIndex,
        opt;
    templates = _.compact(_.flattenDeep(templates));

    let features = await Promise.all(templates.map(async (template) => {
        options.featurePaths = [template.path];
        let scenarioIndex = parseInt(template.scenario) + 1;
        try {
            templatedScenarios = await getFeaturesFromTemplate(options);
            pointScenario = initialFeatures[template.feature].scenarios[template.scenario];
            opt = {
                feature: pointScenario.feature,
                lastStep: pointScenario.steps[pointScenario.steps.length - 1].line
            }
            if (!insertIndex) {
                insertIndex = scenarioIndex;
            } else {
                insertIndex += scenarioIndex;
            }
            initialFeatures[template.feature].scenarios.splice(insertIndex, 0, ...preparingScenariosForConcat(templatedScenarios[0], opt));
            insertIndex = templatedScenarios[0].length;
            return initialFeatures[template.feature];
        } catch (e) {
            console.log(e);
            throw e;
        }
    }));

    const includeTags = options.tags.filter(tag => /^[^~].+$/.test(tag))
    const excludeTags = options.tags.filter(tag => /^~.+$/.test(tag)).map(tag => tag.replace(/~/g, ''))

    return initialFeatures.map(feature => {
        const filteredFeature = feature;
        if (includeTags.length > 0) {
            filteredFeature.scenarios = filteredFeature.scenarios
                .filter(scenario => scenario.tags.find(tag => includeTags.includes(tag.name)))
        }
        if (excludeTags.length > 0) {
            filteredFeature.scenarios = filteredFeature.scenarios
                .filter(scenario => !scenario.tags.find(tag => excludeTags.includes(tag.name)))
        }
        return filteredFeature
    });
}

function findTemplates(features) {
    return features.map((feature, fIndex) => {
        return feature.scenarios.map((scenario, sIndex) => {
            return scenario.steps.map((step, index) => {
                if (step.name.includes('Using template')) {
                    return {
                        feature: fIndex,
                        scenario: sIndex,
                        stepIndex: index,
                        path: path.normalize(path.resolve(step.name.replace(/^Using template "([^"]*)"$/g, '$1')))
                    }
                }
            });
        });
    });
};

async function getFeaturesFromTemplate(options) {
    try {
        let features = await getFeatures(options);
        return features.map(feature => {
            return feature.scenarios
        });
    } catch (e) {
        console.log(e);
        throw e;
    }
}

function preparingScenariosForConcat(scenarios, options) {
    let emptyLine = parseInt(options.lastStep) + 1;
    return scenarios.map(scenario => {
        scenario.feature = options.feature;
        scenario.line = emptyLine++;
        scenario.tags = options.feature.tags.concat(scenario.tags);
        scenario.steps = scenario.steps.map(step => {
            step.line = emptyLine++;
            return step;
        });
        scenario.feature.lastStep = emptyLine - 1;
        return scenario;
    });
}