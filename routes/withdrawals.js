const express = require('express')
const { Transaction } = require("../models/transaction")
const { User } = require("../models/user")
const { alertAdmin, withdrawalMail } = require("../utils/mailer")


const router  = express.Router()



// getting all withdrawals
router.get('/', async(req, res) => {
  try {
    const withdrawals = await Transaction.find()
    res.send(withdrawals)
  } catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})


// getting single withdrawal
router.get('/:id', async(req, res) => {
  const { id } = req.params
  
  try {
    const withdrawal = await Transaction.findById(id)
    if(!withdrawal) return res.status(400).send({message: "Transaction not found..."})
    res.send(withdrawal);
  }
  catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})



// get all withdrawals by user
router.get('/user/:email', async(req, res) => {
  const { email } = req.params

  try {
    const withdrawals = await Transaction.find({ from: email });
    if (!withdrawals || withdrawals.length === 0) return res.status(400).send({message: "Transactions not found..."})
    res.send(withdrawals);
  }
  catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
})


// making a withdrawal
router.post('/', async (req, res) => {
  const { id, amount, convertedAmount, coinName, network, address } = req.body;

  const user = await User.findById(id);
  if (!user) return res.status(400).send({message: 'Something went wrong'})
  
  try {
    const userData = {
      id: user._id, email: user.email, name: user.fullName,
    }

    const walletData = {
      convertedAmount,
      coinName,
      network,
      address,
    }

    // Create a new Deposit instance
    const transaction = new Transaction({ type: "withdrawal", user: userData, amount, walletData });
    await transaction.save();

    const date = transaction.date;
    const type = transaction.type
    const email = transaction.user.email;

  
    const emailData = await alertAdmin(email, amount, date, type)
    if(emailData.error) return res.status(400).send({message: emailData.error})

    res.send({message: 'Withdraw successful and pending approval...'});
  } catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
});


// updating a withdrawal
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { from, amount, status } = req.body;

  const withdrawal = await Transaction.findById(id);
  if (!withdrawal) return res.status(404).send({message: 'Transaction not found'})

  const user = await User.findOne({ email: from });
  if (!user) return res.status(404).send({message: 'User not found'})

  if (user.balance < amount) return res.status(400).send({message: 'Insufficient balance'})
  if (withdrawal.status === 'successful') return res.status(400).send({message: 'Already Approved'})
  
  try {
    user.balance -= amount;
    user.withdraw += amount;
    withdrawal.status = status;
    const { fullName, email } = user;
    const { date } = withdrawal;

    await Promise.all([user.save(), withdrawal.save()]);
    withdrawalMail(fullName, amount, date, email)
    res.send({message: 'Transaction updated successfully...'});
  } catch(e){ for(i in e.errors) res.status(500).send({message: e.errors[i].message}) }
});



module.exports = router;



