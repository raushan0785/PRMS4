const cds = require('@sap/cds')

module.exports = cds.service.impl(function () {
  const { Goals, CheckIns, Assessments, Employees, OKRs } = this.entities

  this.before('CREATE', Goals, async req => {
    const goal = req.data

    if (!goal.employee_ID) {
      return req.reject(400, 'Employee is required for a goal.')
    }

    if (goal.type === 'Performance' && !goal.okr_ID) {
      return req.reject(400, 'Performance goals must be mapped to an OKR.')
    }

    const existingDevelopmentGoals = await SELECT.one
      .from(Goals)
      .columns('count(*) as count')
      .where({
        employee_ID: goal.employee_ID,
        type: 'Development'
      })

    const developmentCount = Number(existingDevelopmentGoals?.count || 0)
    if (goal.type !== 'Development' && developmentCount < 3) {
      return req.reject(400, 'Each employee must have at least 3 Development Goals before other goals can be created.')
    }
  })

  this.on('generateGoals', async req => {
    const role = req.data.role || 'Employee'
    const employees = await SELECT.from(Employees).where({ role })

    if (!employees.length) {
      return `No employees found for role ${role}.`
    }

    const okr = await SELECT.one.from(OKRs)
    const generatedTitles = []

    for (const employee of employees) {
      const existingDevelopmentGoals = await SELECT.one
        .from(Goals)
        .columns('count(*) as count')
        .where({
          employee_ID: employee.ID,
          type: 'Development'
        })

      const developmentCount = Number(existingDevelopmentGoals?.count || 0)
      const missingDevelopmentGoals = Math.max(0, 3 - developmentCount)

      for (let index = 0; index < missingDevelopmentGoals; index += 1) {
        const title = `Development Goal ${developmentCount + index + 1} for ${employee.name}`
        await INSERT.into(Goals).entries({
          title,
          type: 'Development',
          status: 'Open',
          progress: 0,
          employee_ID: employee.ID
        })
        generatedTitles.push(title)
      }

      if (okr) {
        const existingPerformanceGoal = await SELECT.one.from(Goals).where({
          employee_ID: employee.ID,
          type: 'Performance',
          okr_ID: okr.ID
        })

        if (!existingPerformanceGoal) {
          const title = `Performance Goal for ${employee.name}`
          await INSERT.into(Goals).entries({
            title,
            type: 'Performance',
            status: 'Open',
            progress: 0,
            employee_ID: employee.ID,
            okr_ID: okr.ID
          })
          generatedTitles.push(title)
        }
      }
    }

    if (!generatedTitles.length) {
      return `No new goals were needed for role ${role}.`
    }

    return `Generated goals: ${generatedTitles.join(', ')}`
  })

  this.on('improveAssessment', req => {
    const text = (req.data.text || '').trim()
    if (!text) return 'Please provide assessment text to improve.'
    return `Improved assessment suggestion: ${text}`
  })

  this.on('submitCheckIn', async req => {
    const { goalID, comment } = req.data

    if (!goalID) {
      return req.reject(400, 'goalID is required.')
    }

    const goal = await SELECT.one.from(Goals).where({ ID: goalID })
    if (!goal) {
      return req.reject(404, 'Goal not found.')
    }

    await INSERT.into(CheckIns).entries({
      quarter: inferQuarter(),
      status: 'Submitted',
      comments: comment,
      goal_ID: goalID
    })

    return `Check-in submitted for goal ${goalID}.`
  })

  this.on('sendBackAssessment', async req => {
    const { assessmentID } = req.data

    if (!assessmentID) {
      return req.reject(400, 'assessmentID is required.')
    }

    const assessment = await SELECT.one.from(Assessments).where({ ID: assessmentID })
    if (!assessment) {
      return req.reject(404, 'Assessment not found.')
    }

    if (assessment.finalStatus === 'Finalized') {
      return req.reject(400, 'Manager second submission is final.')
    }

    if ((assessment.sendBackCount || 0) >= 1) {
      return req.reject(400, 'Only one send-back is allowed for an assessment.')
    }

    await UPDATE(Assessments)
      .set({ sendBackCount: 1, finalStatus: 'Open' })
      .where({ ID: assessmentID })

    return `Assessment ${assessmentID} sent back successfully.`
  })

  this.before('UPDATE', Assessments, async req => {
    if (req.data.managerRating === undefined) return

    const current = await SELECT.one.from(Assessments).where({ ID: req.data.ID })
    if (!current) return

    const hasManagerSubmission = current.managerRating !== null && current.managerRating !== undefined
    if (hasManagerSubmission && current.sendBackCount >= 1) {
      req.data.finalStatus = 'Finalized'
    }
  })
})

function inferQuarter() {
  const month = new Date().getUTCMonth() + 1
  if (month <= 3) return 'Q1'
  if (month <= 6) return 'Q2'
  if (month <= 9) return 'Q3'
  return 'Q4'
}
